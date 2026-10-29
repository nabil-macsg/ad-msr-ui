/** What a mock handler sees of a request. */
export interface MockRequest {
  readonly method: string;
  readonly path: string;
  readonly params: Readonly<Record<string, string>>;
  readonly query: URLSearchParams;
  readonly headers: Headers;
  readonly body: unknown;
}

export type MockResult = Response | Promise<Response>;
export type Handler = (req: MockRequest) => MockResult;

export const json = (body: unknown, status = 200): Response =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const noContent = (): Response => new Response(null, { status: 204 });

/** The API's error envelope (PROMPT §2.16), so screens show their usual messages. */
export const problem = (status: number, code: string, message: string, details?: unknown) =>
  json({ error: { code, message, ...(details === undefined ? {} : { details }) } }, status);

export const notFound = (what = 'record') =>
  problem(404, 'NOT_FOUND', `The ${what} was not found.`);

/** Thrown inside a handler to answer with an error envelope. */
export class MockError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** A body field as text: strings and numbers as written, anything else empty. */
export const text = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';

/** The body as an object; handlers validate what they read. */
export const bodyOf = (req: MockRequest): Record<string, unknown> =>
  (req.body ?? {}) as Record<string, unknown>;

/** Required text field: refuses blank values the way the API does (422 VALIDATION_FAILED). */
export function required(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new MockError(422, 'VALIDATION_FAILED', 'Some fields need attention.', {
      fields: { [field]: 'Required' },
    });
  }
  return value.trim();
}
