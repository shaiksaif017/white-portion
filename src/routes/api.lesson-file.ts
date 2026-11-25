// Lesson materials (worksheets, PDFs) for enrolled students only.
//   GET /api/lesson-file?l=<lesson id>
import { createFileRoute } from "@tanstack/react-router";
import { getRequestIP } from "@tanstack/react-start/server";

import { rateLimit } from "@/server/auth";
import { lessonAttachmentFor } from "@/server/courses";
import { customerFromRequest } from "@/server/customers";
import { getFileInfo, readFileData } from "@/server/files";

export const Route = createFileRoute("/api/lesson-file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const lessonId = Number(new URL(request.url).searchParams.get("l"));
        if (!Number.isInteger(lessonId) || lessonId <= 0) {
          return new Response("Not found", { status: 404 });
        }
        if (
          !rateLimit(
            `lesson-file:${getRequestIP({ xForwardedFor: true }) ?? "unknown"}`,
            60,
            60 * 60_000,
          )
        ) {
          return new Response("Too many downloads. Please try again later.", { status: 429 });
        }
        try {
          const me = await customerFromRequest();
          if (!me)
            return new Response("Please log in to download course materials.", { status: 401 });
          const fileId = await lessonAttachmentFor(me.email, lessonId);
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
            },
          });
        } catch (error) {
          console.error("[lesson-file] failed", error);
          return new Response("Unavailable", { status: 503 });
        }
      },
    },
  },
});
