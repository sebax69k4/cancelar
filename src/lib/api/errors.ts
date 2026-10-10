export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'WORKFLOW_RULE'
  | 'CONFLICT'
  | 'NETWORK';

const STATUS: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  WORKFLOW_RULE: 422,
  CONFLICT: 409,
  NETWORK: 503,
};

/** Error normalizado. El HttpApiClient futuro debe mapear las respuestas de NestJS a esta forma. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  /** Lista legible de requisitos faltantes o campos inválidos. */
  readonly details: readonly string[];

  constructor(code: ApiErrorCode, message: string, details: readonly string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Ocurrió un error inesperado';
}
