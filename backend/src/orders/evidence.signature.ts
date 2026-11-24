/**
 * Revisión del contenido de cada evidencia antes de guardarla. El tipo que declara el navegador
 * se puede falsear, así que se mira el archivo en sí:
 *  1. la firma (los primeros bytes, o «magic number») tiene que ser la del tipo declarado;
 *  2. la estructura tiene que estar completa, sin datos pegados al final (así se arman los
 *     archivos «políglotas»: una foto válida con un programa o una página web escondidos);
 *  3. no puede traer código: HTML, scripts, PHP o un ejecutable de Windows incrustado;
 *  4. un PDF no puede traer JavaScript, adjuntos ni acciones que se ejecuten al abrirlo.
 */
import { inflateSync } from 'node:zlib';

const ascii = (buf: Buffer, start: number, end: number) => buf.subarray(start, end).toString('latin1');

/** Marcas («brands») de contenedores ISO-BMFF que usan HEIC y HEIF. */
const MARCAS_HEIF = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'heif']);

const FIRMAS: Record<string, (buf: Buffer) => boolean> = {
  'image/jpeg': (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/gif': (b) => ['GIF87a', 'GIF89a'].includes(ascii(b, 0, 6)),
  'image/webp': (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP',
  'image/heic': (b) => ascii(b, 4, 8) === 'ftyp' && MARCAS_HEIF.has(ascii(b, 8, 12)),
  'image/heif': (b) => ascii(b, 4, 8) === 'ftyp' && MARCAS_HEIF.has(ascii(b, 8, 12)),
  // Algunos generadores anteponen bytes antes de %PDF-: se busca en el primer kilobyte
  'application/pdf': (b) => ascii(b, 0, 1024).includes('%PDF-'),
};

/** Extensión con la que se guarda cada tipo: nunca la del nombre original (podría ser .php o .exe). */
export const EXTENSION_EVIDENCIA: Readonly<Record<string, string>> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
  'image/heic': '.heic', 'image/heif': '.heif', 'application/pdf': '.pdf',
};

/** Fin del archivo PNG: el bloque IEND (largo 0, tipo, CRC fijo). */
const PNG_IEND = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);

/**
 * Estructura completa y sin datos agregados al final. Los JPEG y HEIC no se controlan acá:
 * varios celulares guardan legítimamente datos después de la imagen (fotos con movimiento).
 */
const ESTRUCTURA: Record<string, (buf: Buffer) => boolean> = {
  'image/png': (b) => b.length >= 20 && b.subarray(b.length - 12).equals(PNG_IEND),
  'image/gif': (b) => b.length >= 14 && b[b.length - 1] === 0x3b,
  // El tamaño declarado en la cabecera RIFF tiene que coincidir con el del archivo
  'image/webp': (b) => b.length >= 16 && b.readUInt32LE(4) + 8 === b.length,
  // Tiene que terminar con %%EOF (se toleran espacios y saltos de línea después)
  'application/pdf': (b) => /%%EOF[\s\0]*$/.test(ascii(b, Math.max(0, b.length - 1024), b.length)),
};

/**
 * Restos de código que no tienen nada que hacer en una foto o un PDF. Son secuencias de al
 * menos 5 bytes: que aparezcan por azar en los bytes de una imagen es prácticamente imposible.
 */
const CODIGO = [
  '<script', '<html', '<!doctype html', '<iframe', '<svg ', '<svg>', '<object', '<embed', '<?php',
  'javascript:', 'vbscript:', 'this program cannot be run in dos mode', // ejecutable de Windows
];

/** Claves de PDF que ejecutan código, abren programas o esconden archivos. */
const PDF_PELIGROSO = /\/(?:JavaScript|JS|Launch|EmbeddedFiles?|RichMedia|XFA|SubmitForm|ImportData|GoToE)(?![A-Za-z0-9])/;

/** En los nombres de PDF «#4A» equivale a «J»: así se intenta esconder /JavaScript. */
const decodificarNombresPdf = (texto: string) => texto.replace(/#([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));

/**
 * Límite al descomprimir los objetos de un PDF, sumando todos: un archivo chico no puede inflarse
 * sin fin («bomba zip»), ni de una vez ni repartido en muchos objetos.
 */
const MAX_DESCOMPRIMIDO = 20 * 1024 * 1024;

/**
 * La parte del PDF donde puede haber acciones: todo lo que está fuera de los «streams» (los
 * datos de imágenes y fuentes, comprimidos, darían coincidencias por azar) más el contenido
 * descomprimido de los «object streams», donde se pueden esconder diccionarios enteros.
 * null si un object stream no se puede descomprimir dentro del límite.
 */
function textoRevisablePdf(texto: string): string | null {
  const partes: string[] = [];
  const inicio = /(?<!end)stream\r?\n/g;
  let cursor = 0;
  let disponible = MAX_DESCOMPRIMIDO;
  for (let m = inicio.exec(texto); m; m = inicio.exec(texto)) {
    const datos = m.index + m[0].length;
    const fin = texto.indexOf('endstream', datos);
    if (fin < 0) break;
    // Se busca solo en el tramo desde el stream anterior: buscando en todo el texto, un PDF con
    // cientos de miles de streams tardaba minutos y frenaba el servidor entero
    const tramo = texto.slice(cursor, m.index);
    const diccionario = tramo.slice(Math.max(0, tramo.lastIndexOf('obj')));
    partes.push(tramo);
    if (/\/Type\s*\/ObjStm/.test(diccionario)) {
      if (!/\/FlateDecode/.test(diccionario)) {
        partes.push(texto.slice(datos, fin)); // sin comprimir: se revisa tal cual
      } else {
        try {
          const inflado = inflateSync(Buffer.from(texto.slice(datos, fin).replace(/\r?\n$/, ''), 'latin1'), { maxOutputLength: Math.max(1, disponible) });
          disponible -= inflado.length;
          partes.push(inflado.toString('latin1'));
        } catch {
          return null;
        }
      }
    }
    cursor = fin + 'endstream'.length;
    inicio.lastIndex = cursor;
  }
  partes.push(texto.slice(cursor));
  return partes.join('\n');
}

/** true si el contenido corresponde al tipo declarado (y el tipo está entre los admitidos). */
export function coincideFirma(mime: string, contenido: Buffer): boolean {
  const verificar = FIRMAS[mime];
  return verificar !== undefined && verificar(contenido);
}

export const MENSAJES_EVIDENCIA = {
  firma: 'El contenido del archivo no corresponde a una foto o un PDF',
  estructura: 'El archivo está dañado o tiene datos agregados que no son parte de la foto o el PDF',
  codigo: 'El archivo contiene código (HTML, scripts o un programa) y no se acepta como evidencia',
  pdf: 'El PDF contiene JavaScript, archivos adjuntos o acciones automáticas y no se acepta como evidencia',
} as const;

/** null si el archivo se puede guardar; si no, el motivo para mostrarle a quien lo sube. */
export function problemaEvidencia(mime: string, contenido: Buffer): string | null {
  if (!coincideFirma(mime, contenido)) return MENSAJES_EVIDENCIA.firma;
  const estructura = ESTRUCTURA[mime];
  if (estructura && !estructura(contenido)) return MENSAJES_EVIDENCIA.estructura;
  let texto = contenido.toString('latin1');
  if (mime === 'application/pdf') {
    const revisable = textoRevisablePdf(texto);
    if (revisable === null) return MENSAJES_EVIDENCIA.estructura;
    texto = revisable;
  }
  const minusculas = texto.toLowerCase();
  if (CODIGO.some((marca) => minusculas.includes(marca))) return MENSAJES_EVIDENCIA.codigo;
  if (mime === 'application/pdf' && PDF_PELIGROSO.test(decodificarNombresPdf(texto))) return MENSAJES_EVIDENCIA.pdf;
  return null;
}

/**
 * Nombre visible del archivo: sin carpetas, sin caracteres de control (saltos de línea que
 * podrían partir una cabecera HTTP) y con largo acotado.
 */
export function nombreSeguro(original: string): string {
  const base = original.split(/[\\/]/).pop() ?? '';
  const limpio = base.replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 200);
  return limpio === '' || /^\.+$/.test(limpio) ? 'archivo' : limpio;
}
