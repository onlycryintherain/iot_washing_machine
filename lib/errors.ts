export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

// Drizzle wraps driver errors in DrizzleQueryError, so the PostgreSQL code lives on `cause`.
export function errorCode(error: unknown): string | undefined {
  for (let current: unknown = error, depth = 0; current && typeof current === 'object' && depth < 5; depth++) {
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (typeof code === 'string') return code;
    current = cause;
  }
}

// Logs the root cause only: DrizzleQueryError's own message embeds query parameters such as student IDs and token hashes.
export function describeError(error: unknown): string {
  let root: unknown = error;
  for (let depth = 0; root instanceof Error && root.cause && depth < 5; depth++) root = root.cause;
  const message = root instanceof Error ? root.message : 'Unknown error';
  const code = errorCode(error);
  return code ? `[${code}] ${message}` : message;
}
