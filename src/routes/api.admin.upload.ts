// Admin-only upload endpoint for product images (public) and e-book files (private).
//   POST /api/admin/upload?kind=image|download|preview&name=<filename>   body = raw file bytes
//   image    = public product image (JPG/PNG/WebP)
//   download = private paid file (PDF/EPUB/ZIP), only released to buyers
//   preview  = public free sample of an e-book (PDF only)
import { createFileRoute } from "@tanstack/react-router";

import { isAdminRequest, isSameOrigin } from "@/server/admin-session";
import { rateLimit } from "@/server/auth";
import {
  DOWNLOAD_TYPES,
  IMAGE_TYPES,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
  saveFile,
  sniffMime,
} from "@/server/files";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/admin/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isSameOrigin(request)) return json({ ok: false, error: "Bad origin." }, 403);
        if (!isAdminRequest())
          return json({ ok: false, error: "Your session has expired. Please log in again." }, 401);
        if (!rateLimit("admin-upload", 200, 60 * 60_000))
          return json({ ok: false, error: "Too many uploads. Try again later." }, 429);

        const url = new URL(request.url);
        const kind = url.searchParams.get("kind");
        const name =
          (url.searchParams.get("name") ?? "file").replace(/[^\w.\- ]+/g, "_").slice(0, 120) ||
          "file";
        if (kind !== "image" && kind !== "download" && kind !== "preview")
          return json({ ok: false, error: "Unknown upload type." }, 400);

        const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
        const declared = Number(request.headers.get("content-length") ?? 0);
        if (declared > max)
          return json(
            { ok: false, error: `File is too large (max ${max / 1024 / 1024} MB).` },
            413,
          );

        const data = Buffer.from(await request.arrayBuffer());
        if (data.length === 0) return json({ ok: false, error: "The file is empty." }, 400);
        if (data.length > max)
          return json(
            { ok: false, error: `File is too large (max ${max / 1024 / 1024} MB).` },
            413,
          );

        const mime = sniffMime(data);
        const allowed =
          kind === "image"
            ? IMAGE_TYPES
            : kind === "preview"
              ? { "application/pdf": "pdf" }
              : DOWNLOAD_TYPES;
        if (!mime || !(mime in allowed)) {
          return json(
            {
              ok: false,
              error:
                kind === "image"
                  ? "Please upload a JPG, PNG or WebP image."
                  : kind === "preview"
                    ? "Please upload the free preview as a PDF."
                    : "Please upload a PDF, EPUB or ZIP file.",
            },
            415,
          );
        }
        try {
          const id = await saveFile(name, mime, data, kind !== "download");
          return json({ ok: true, id, name, size: data.length });
        } catch (error) {
          console.error("[upload] failed", error);
          return json({ ok: false, error: "Could not save the file." }, 500);
        }
      },
    },
  },
});
