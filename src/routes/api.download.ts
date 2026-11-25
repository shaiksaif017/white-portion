// E-book download for paid orders.
//   GET /api/download?o=<order number>&t=<order access token>&i=<order item id>
import { createFileRoute } from "@tanstack/react-router";
import { getRequestIP } from "@tanstack/react-start/server";

import { rateLimit } from "@/server/auth";
import { getFileInfo, readFileData } from "@/server/files";
import { getDownloadFileId } from "@/server/orders";

export const Route = createFileRoute("/api/download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const order = url.searchParams.get("o") ?? "";
        const token = url.searchParams.get("t") ?? "";
        const item = Number(url.searchParams.get("i"));
        if (
          !/^WP-[A-Z0-9]{6}$/.test(order) ||
          !/^[a-f0-9]{48}$/.test(token) ||
          !Number.isInteger(item) ||
          item <= 0
        ) {
          return new Response("Not found", { status: 404 });
        }
        const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
        if (!rateLimit(`download:${ip}`, 60, 60 * 60_000)) {
          return new Response("Too many downloads. Please try again later.", { status: 429 });
        }
        try {
          const fileId = await getDownloadFileId(order, token, item);
          const info = fileId ? await getFileInfo(fileId) : null;
          if (!fileId || !info) return new Response("Not found", { status: 404 });
          const data = await readFileData(fileId);
          const safeName = info.name.replace(/[^\w.\- ]+/g, "_") || "download";
          return new Response(new Uint8Array(data), {
            headers: {
              "content-type": info.mime,
              "content-length": String(data.length),
              "content-disposition": `attachment; filename="${safeName}"`,
              "cache-control": "private, no-store",
              "x-content-type-options": "nosniff",
              // even if a browser ignores "attachment", nothing in the file can run
              "content-security-policy": "default-src 'none'; sandbox",
              "cross-origin-resource-policy": "same-origin",
            },
          });
        } catch (error) {
          console.error("[download] failed", error);
          return new Response("Unavailable", { status: 503 });
        }
      },
    },
  },
});
