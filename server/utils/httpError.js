export class HttpError extends Error {
  constructor(statusCode, message, meta = {}) {
    super(message);
    this.statusCode = statusCode;
    this.meta = meta;
  }
}

export const badRequest = (message, meta) => new HttpError(400, message, meta);
export const unauthorized = (message = 'Unauthorized', meta) => new HttpError(401, message, meta);
export const forbidden = (message = 'Forbidden', meta) => new HttpError(403, message, meta);
export const notFound = (message = 'Not found', meta) => new HttpError(404, message, meta);
export const tooManyRequests = (message = 'Rate limit exceeded', meta) => new HttpError(429, message, meta);
export const internal = (message = 'Internal Server Error', meta) => new HttpError(500, message, meta);
