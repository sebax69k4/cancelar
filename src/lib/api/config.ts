/**
 * Modo de datos:
 *  - sin PUBLIC_API_URL → demo con localStorage (MockApiClient + sesión simulada)
 *  - con PUBLIC_API_URL (ej. http://localhost:3000/api) → backend NestJS real
 */
export const API_URL: string | undefined = import.meta.env.PUBLIC_API_URL?.replace(/\/$/, '') || undefined;

export const isMockApi = API_URL === undefined;
