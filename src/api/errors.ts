/** The API's error envelope (PROMPT §2.16). */
export interface ErrorEnvelope {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
    readonly correlationId?: string;
  };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static from(status: number, body: unknown): ApiError {
    const envelope = body as Partial<ErrorEnvelope> | undefined;
    const error = envelope?.error;
    if (error && typeof error.code === 'string' && typeof error.message === 'string') {
      return new ApiError(status, error.code, error.message, error.details, error.correlationId);
    }
    return new ApiError(status, 'UNKNOWN', 'Something went wrong. Try again.');
  }
}

/** Unwraps an openapi-fetch result: the data, or an ApiError. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok) {
    throw ApiError.from(result.response.status, result.error);
  }
  return result.data as T;
}
