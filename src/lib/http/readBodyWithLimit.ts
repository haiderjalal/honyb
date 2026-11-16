/**
 * Reads the body as text, stopping as soon as it exceeds `maxBytes`, so an oversized request is never buffered in full.
 * Returns null when the limit is exceeded. The declared Content-Length is checked first, so most oversized requests are
 * refused before any of the body is read.
 */
export async function readBodyWithLimit(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return null;
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
