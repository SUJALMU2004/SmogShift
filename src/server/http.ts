export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown, fallback: string) {
  const status = error instanceof HttpError ? error.status : 503;
  const message = error instanceof HttpError ? error.message : fallback;
  return Response.json({ error: message }, { status });
}

export async function readJson(
  request: Request,
  limit: number,
): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim();
  if (contentType !== "application/json")
    throw new HttpError(415, "Expected a JSON request.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Request body is missing.");

  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new HttpError(413, "The routine is too large.");
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid JSON request.");
  } finally {
    reader.releaseLock();
  }
}
