// Serves public uploaded files (product images) from the database.
// Private files (e-books) are never served here.
import { createFileRoute } from "@tanstack/react-router";

import { getFileInfo, readFileData } from "@/server/files";

export const Route = createFileRoute("/media/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = Number(params.id);
        if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
        try {
          const info = await getFileInfo(id);
          if (!info || !info.isPublic) return new Response("Not found", { status: 404 });
          const data = await readFileData(id);
          return new Response(new Uint8Array(data), {
            headers: {
              "content-type": info.mime,
              "content-length": String(data.length),
              // A file id always points at the same bytes, so it can be cached for a year.
              "cache-control": "public, max-age=31536000, immutable",
              "x-content-type-options": "nosniff",
            },
          });
        } catch (error) {
          console.error("[media] failed", error);
          return new Response("Unavailable", { status: 503 });
        }
      },
    },
  },
});
