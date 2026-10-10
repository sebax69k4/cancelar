import { errorMessage, isApiError } from './api/errors';
import { toast } from './toast';

/** Muestra un error de API como toast, con la lista de requisitos faltantes si la hay. */
export function notifyError(e: unknown): void {
  toast.error(errorMessage(e), { details: isApiError(e) ? e.details : undefined });
}
