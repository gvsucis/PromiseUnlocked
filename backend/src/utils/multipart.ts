import type { Request } from "express";
import type { Writable } from "node:stream";

// Feed a multipart request into Busboy. The body is already buffered on Cloud
// Run (req.rawBody) and in local dev (express.raw → req.body), so piping the
// consumed stream would fail — use the buffer, stream only as a fallback.
export function feedBusboy(req: Request, bb: Writable): void {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (Buffer.isBuffer(rawBody) && rawBody.length > 0) {
    bb.end(rawBody);
  } else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
    bb.end(req.body);
  } else {
    req.pipe(bb);
  }
}
