export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function errorResponse(error: unknown, fallback: string) {
  const status = error instanceof HttpError ? error.status : 503;
  const message = error instanceof HttpError ? error.message : fallback;
  return jsonResponse({ error: message }, status);
}

export function requireSameOrigin(request: Request): void {
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new HttpError(403, "Requests must come from SmogShift.");

  const origin = request.headers.get("origin");
  if (origin === null) return;

  const target = new URL(request.url);
  const host = request.headers.get("host") ?? target.host;
  const client = URL.parse(origin);
  if (client?.protocol !== target.protocol || client.host !== host)
    throw new HttpError(403, "Requests must come from SmogShift.");
}

function requireJsonContentType(request: Request): void {
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json")
    throw new HttpError(415, "Expected a JSON request.");
}

/** Decode a UTF-8 JSON body without buffering beyond the byte limit. */
export async function readJson(
  request: Request,
  limit: number,
): Promise<unknown> {
  requireJsonContentType(request);
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Request body is missing.");

  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel().catch(() => undefined);
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
