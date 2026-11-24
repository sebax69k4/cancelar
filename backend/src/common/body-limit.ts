import type { NextFunction, Request, Response } from 'express';
import { eventoSeguridad } from './security-log';

const MB = 1024 * 1024;
/** Cualquier pedido que no sea subir una evidencia es un JSON chico (Express ya lo corta en 100 KB). */
export const MAX_CUERPO = 256 * 1024;
/** Lo que agrega el multipart alrededor del archivo (separadores y cabeceras). */
export const MARGEN_MULTIPART = 64 * 1024;
/** Cada cuánto se mira cuánto mandó un pedido que no declara su tamaño. */
const CONTROL_MS = 25;

const RUTA_SUBIDA = /^\/api\/orders\/[^/]+\/evidence\/?$/;

/**
 * Corta los pedidos demasiado pesados sin recibirlos enteros. Un script (no el navegador, que
 * ya avisa) puede mandar varios GB: sin esto, el servidor los leía completos antes de contestar
 * que eran demasiado grandes, incluso sin sesión iniciada.
 *  - Si declara el tamaño (Content-Length), se rechaza antes de leer nada.
 *  - Si no lo declara (chunked), se corta la conexión en cuanto pasa el límite.
 */
export function limiteCuerpo(maxSubidaMb: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const esSubida = req.method === 'POST' && RUTA_SUBIDA.test(req.path);
    const tope = esSubida ? maxSubidaMb * MB + MARGEN_MULTIPART : MAX_CUERPO;
    const mensaje = esSubida ? `El archivo supera el tamaño máximo de ${maxSubidaMb} MB` : 'La solicitud es demasiado grande';

    const rechazar = () => {
      eventoSeguridad('cuerpo.demasiado_grande', { ip: req.ip, metodo: req.method, ruta: req.path, declarado: req.headers['content-length'] });
      // Con «close», Node cierra la conexión al terminar de responder en vez de leer el resto
      res.set('Connection', 'close').status(413).json({ statusCode: 413, message: mensaje });
    };

    if (Number(req.headers['content-length']) > tope) return rechazar();

    if (req.headers['transfer-encoding'] !== undefined) {
      const { socket } = req;
      const inicio = socket.bytesRead;
      const control = setInterval(() => {
        if (req.complete || socket.destroyed) return clearInterval(control);
        if (socket.bytesRead - inicio <= tope) return;
        clearInterval(control);
        if (res.headersSent) return void socket.destroy();
        res.once('finish', () => socket.destroy());
        rechazar();
      }, CONTROL_MS);
      control.unref();
    }
    next();
  };
}
