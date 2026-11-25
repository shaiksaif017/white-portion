// Reads a request body but stops as soon as it passes `max` bytes, so an anonymous
// sender can't make the server buffer a huge upload in memory.
export async function readBodyLimited(request: Request, max: number): Promise<Buffer | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > max) return null;
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
