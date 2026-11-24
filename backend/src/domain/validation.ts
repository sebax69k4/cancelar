/**
 * Reglas de los datos que se cargan a mano. Copia fiel de frontend/src/lib/workflow/validation.ts.
 */

/**
 * Teléfono: solo números, espacios, +, - y paréntesis; entre 6 y 15 dígitos (máximo internacional).
 * El + va al principio y los paréntesis van de a pares con números adentro.
 */
export const TELEFONO_RE = /^[+\d ()-]+$/;
const TELEFONO_ARMADO_RE = /^\+?(?:[\d -]|\(\+?[ -]*\d[\d -]*\))+$/;
export const TEL_MIN_DIGITOS = 6;
export const TEL_MAX_DIGITOS = 15;
export const TEL_MAX_LARGO = 30;

/** Nombres de personas, clientes, talleres y servicios: al menos una letra (no «123» ni «!!»). */
export const TIENE_LETRA_RE = /\p{L}/u;

/** Largo máximo de los textos cortos que se cargan al crear algo o al ingresar (nombres, email, contraseña…). */
export const MAX_TEXTO = 40;

/**
 * Caracteres admitidos en un nombre: letras (con tildes y ñ), números, espacios y unos pocos signos.
 * Quedan afuera < > " ; ` { } [ ] \ | = * % $ @ ! ?, los de control y los invisibles. El primero es una
 * letra o un número: así un nombre tampoco puede pasar por fórmula (=, +, -, @) en una planilla.
 */
export const NOMBRE_RE = /^[\p{L}\d .,'’&()/+ºª°#_-]*$/u;
export const EMPIEZA_BIEN_RE = /^[\p{L}\d]/u;

/** Email en minúsculas: sin espacios, comillas ni caracteres raros. */
const EMAIL_USUARIO_RE = /^[a-z0-9_%+-]+(\.[a-z0-9_%+-]+)*$/;
const EMAIL_PARTE_DOMINIO_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/** Caracteres de control e invisibles (saltos de línea, espacios de ancho cero, marcas de dirección…). */
const INVISIBLES_RE = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}\u2028\u2029]/u;

/** Los mismos dentro de un texto libre, salvo renglones, tabulaciones y la unión de emojis compuestos (👨‍👩‍👧). */
const INVISIBLES_TEXTO_RE = /\u200D(?!\p{Extended_Pictographic})|(?![\u200D\n\t])[\p{Cc}\p{Cf}\p{Co}\p{Cs}]/gu;

/** Tildes apiladas sin fin sobre una letra («zalgo»), que tapan los renglones vecinos. */
const APILADAS_RE = /\p{M}{3,}/u;
const TIENE_PALABRAS_RE = /[\p{L}\p{N}]/u;

/** Contraseñas: largo mínimo (MIN_PASSWORD en setup.ts) con al menos una letra y un número. */
export const TIENE_NUMERO_RE = /\d/;
export const MAX_PASSWORD = MAX_TEXTO;

export const MAX_EMAIL = MAX_TEXTO;

/** Precio de un servicio, en pesos enteros. */
export const PRECIO_MAX = 100_000_000;

/** La fecha estimada de entrega va de hoy hasta un año adelante. */
export const MAX_DIAS_ESTIMADA = 365;

/** Texto de búsqueda. */
export const MAX_BUSQUEDA = 100;

/** Tamaño máximo de cada archivo de evidencia, en MB. UPLOAD_MAX_MB solo puede bajarlo. */
export const MAX_EVIDENCIA_MB = 10;

/** Deja un nombre prolijo: sin espacios adelante ni atrás, sin espacios dobles y con las tildes unificadas. */
export function limpiarNombre(texto: string): string {
  return texto.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/**
 * Deja prolijo un texto libre (falla, diagnóstico, comentarios, notas…): sin caracteres invisibles ni de
 * control, sin espacios adelante ni atrás y con las tildes unificadas. Conserva los renglones.
 */
export function limpiarTexto(texto: string): string {
  return texto
    .replace(/\r\n?|[\u0085\u2028\u2029]/g, '\n')
    .replace(INVISIBLES_TEXTO_RE, '')
    .normalize('NFC')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Problema de un texto libre ya pasado por limpiarTexto (null si está bien). Admite cualquier símbolo
 * visible (15.6", <60 Hz, emojis): se guarda y se muestra siempre como texto.
 */
export function problemaTexto(campo: string, texto: string, min: number, max: number, siEsCorto?: string): string | null {
  if (texto.length < min) return siEsCorto ?? `${campo}: mínimo ${min} caracteres`;
  if (texto.length > max) return `${campo}: máximo ${max} caracteres`;
  if (texto !== '' && !TIENE_PALABRAS_RE.test(texto)) return `${campo}: escribí palabras o números, no solo signos`;
  if (APILADAS_RE.test(texto)) return `${campo}: tiene caracteres que no se admiten`;
  return null;
}

/** Problema de un nombre ya pasado por limpiarNombre (null si está bien). El largo se mira primero. */
export function problemaNombre(campo: string, texto: string, min = 2, conLetras = true): string | null {
  if (texto.length < min) return min === 1 ? `${campo}: no puede quedar vacío` : `${campo}: mínimo ${min} caracteres`;
  if (texto.length > MAX_TEXTO) return `${campo}: máximo ${MAX_TEXTO} caracteres`;
  if (!NOMBRE_RE.test(texto)) return `${campo}: usá solo letras, números, espacios y . , ' & ( ) / + # _ -`;
  if (!EMPIEZA_BIEN_RE.test(texto)) return `${campo}: tiene que empezar con una letra o un número`;
  if (conLetras && !TIENE_LETRA_RE.test(texto)) return `${campo}: tiene que tener letras`;
  return null;
}

/** Problema de un email ya recortado y en minúsculas (null si está bien). El largo se mira primero. */
export function problemaEmail(email: string): string | null {
  if (email.length > MAX_EMAIL) return `El email no puede tener más de ${MAX_EMAIL} caracteres`;
  const [usuario, dominio, ...resto] = email.split('@');
  const partes = (dominio ?? '').split('.');
  const bien =
    resto.length === 0 && EMAIL_USUARIO_RE.test(usuario ?? '') && partes.length >= 2 &&
    partes.every((p) => EMAIL_PARTE_DOMINIO_RE.test(p)) && /^[a-z]{2,}$/.test(partes[partes.length - 1] ?? '');
  return bien ? null : 'Ingresá un email válido';
}

/** Lo que vale para cualquier contraseña, al crearla y al ingresar (null si está bien). */
export function problemaPasswordEscrita(password: string): string | null {
  if (password.length > MAX_PASSWORD) return `La contraseña no puede tener más de ${MAX_PASSWORD} caracteres`;
  if (INVISIBLES_RE.test(password)) return 'La contraseña tiene caracteres invisibles que no se admiten';
  if (password !== password.trim()) return 'La contraseña no puede empezar ni terminar con espacios';
  return null;
}

/** Número de serie: empieza con letra o número («---» no es un número de serie). */
export const SERIE_RE = /^[A-Za-z0-9][A-Za-z0-9\-_/.]*$/;

/** Largo máximo de los textos libres. */
export const MAX_FALLA = 1000;
export const MAX_DETALLE = 2000;
export const MAX_COMENTARIO = 500;
export const MAX_NOTAS = 300;
export const MAX_DIRECCION = 200;

/** Cantidad máxima de evidencias por orden. */
export const MAX_EVIDENCIAS = 30;

export function digitosTelefono(telefono: string): number {
  return telefono.replace(/\D/g, '').length;
}

/** Problemas de un teléfono, en el orden en que conviene mostrarlos (vacío si está bien). */
export function problemaTelefono(telefono: string): string | null {
  if (telefono.length <= TEL_MAX_LARGO * 2) {
    if (!TELEFONO_RE.test(telefono)) return 'Teléfono: usá solo números, espacios, +, - o paréntesis';
    if (!TELEFONO_ARMADO_RE.test(telefono)) return 'Teléfono: revisá los paréntesis y el + (va al principio)';
  }
  const n = digitosTelefono(telefono);
  if (n < TEL_MIN_DIGITOS) return `El teléfono debe tener al menos ${TEL_MIN_DIGITOS} dígitos`;
  if (n > TEL_MAX_DIGITOS || telefono.length > TEL_MAX_LARGO) return `El teléfono no puede tener más de ${TEL_MAX_DIGITOS} dígitos`;
  return null;
}

/** Problema de una contraseña nueva (null si está bien). */
export function problemaPassword(password: string, minimo: number): string | null {
  if (password.length < minimo) return `La contraseña debe tener al menos ${minimo} caracteres`;
  const escrita = problemaPasswordEscrita(password);
  if (escrita) return escrita;
  if (!TIENE_LETRA_RE.test(password) || !TIENE_NUMERO_RE.test(password)) return 'La contraseña tiene que combinar letras y números';
  return null;
}

/** Último día (incluido) aceptado como fecha estimada, contando desde el inicio de hoy. */
export function limiteFechaEstimada(inicioHoyMs: number): number {
  return inicioHoyMs + (MAX_DIAS_ESTIMADA + 1) * 86_400_000;
}
