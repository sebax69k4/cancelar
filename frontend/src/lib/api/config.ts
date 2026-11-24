/**
 * Dirección del backend NestJS (ej. https://api.mitaller.com/api). Es obligatoria: sin ella
 * el frontend no compila, así nunca se publica una versión que no sabe a qué servidor hablar.
 */
const url = import.meta.env.PUBLIC_API_URL?.trim().replace(/\/$/, '');
if (!url) {
  throw new Error('Falta PUBLIC_API_URL en frontend/.env (ej. PUBLIC_API_URL=http://localhost:3000/api)');
}

export const API_URL: string = url;
