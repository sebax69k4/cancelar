import type { NextFunction, Request, Response } from 'express';
import { eventoSeguridad } from './security-log';

/** Los únicos enlaces que la app abre de verdad: ver o descargar una evidencia. */
const RUTA_ARCHIVO = /^\/api\/orders\/[^/]+\/evidence\/[^/]+\/file\/?$/i;
/** Control de salud: no muestra datos y lo consultan los servicios de monitoreo. */
const RUTA_SALUD = /^\/api\/health\/?$/i;
const RUTA_DOCS = /^\/api\/docs(?:[/-]|$)/i;
/** Destinos con los que el navegador muestra una respuesta como página (pestaña o marco). */
const DESTINOS_PAGINA = new Set(['document', 'iframe', 'frame', 'embed', 'object']);

/**
 * true si el navegador está abriendo la dirección como página (barra de direcciones, enlace, pestaña
 * nueva de las herramientas de desarrollo) y no si la app está pidiendo datos. Los navegadores viejos
 * no mandan Sec-Fetch-*: ahí se mira si piden HTML.
 */
export function esNavegacion(req: Pick<Request, 'headers' | 'method'>): boolean {
  const modo = req.headers['sec-fetch-mode'];
  const destino = req.headers['sec-fetch-dest'];
  if (modo !== undefined || destino !== undefined) return modo === 'navigate' || DESTINOS_PAGINA.has(String(destino));
  return String(req.headers.accept ?? '').toLowerCase().includes('text/html');
}

/** La misma página para todo: no dice si la dirección existe, ni que hay una API detrás. */
export function paginaNoEncontrada(res: Response): void {
  res.status(404).type('html').send(
    '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>404</title></head><body><h1>404</h1><p>No se encontró la página.</p></body></html>',
  );
}

/**
 * La API solo le contesta a la app. Abrir una de sus direcciones en el navegador da 404, exista o no,
 * haya o no una sesión. Además ninguna respuesta queda guardada en el navegador ni en intermediarios.
 *
 * No reemplaza a los permisos (sin sesión no hay datos, y cada taller ve solo lo suyo): evita que se
 * vea el formato interno y que se puedan explorar direcciones a mano.
 */
export function soloParaLaApp(conDocs: boolean) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.set('Cache-Control', 'no-store');
    if (!esNavegacion(req) || RUTA_ARCHIVO.test(req.path) || RUTA_SALUD.test(req.path) || (conDocs && RUTA_DOCS.test(req.path))) return next();
    eventoSeguridad('api.abierta_como_pagina', { ip: req.ip, metodo: req.method, ruta: req.path });
    paginaNoEncontrada(res);
  };
}
