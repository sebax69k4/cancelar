import { aBase32, cifrarSecreto, codigoTotp, deBase32, descifrarSecreto, nuevoSecretoTotp, pasoActual, verificarTotp } from './totp';

describe('segundo factor (TOTP)', () => {
  // Vector oficial del RFC 6238 (SHA-1): secreto ASCII «12345678901234567890»
  const secreto = aBase32(Buffer.from('12345678901234567890'));

  it('coincide con los vectores del RFC 6238', () => {
    expect(secreto).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(codigoTotp(secreto, Math.floor(59 / 30), 8)).toBe('94287082');
    expect(codigoTotp(secreto, Math.floor(1111111109 / 30), 8)).toBe('07081804');
    expect(codigoTotp(secreto, Math.floor(1234567890 / 30), 8)).toBe('89005924');
    expect(codigoTotp(secreto, Math.floor(20000000000 / 30), 8)).toBe('65353130');
  });

  it('base32 ida y vuelta', () => {
    const s = nuevoSecretoTotp();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(aBase32(deBase32(s))).toBe(s);
  });

  it('acepta 30 s de diferencia de reloj, rechaza más y no deja reusar un código', () => {
    const ahora = 1_800_000_000_000;
    const p = pasoActual(ahora);
    expect(verificarTotp(secreto, codigoTotp(secreto, p), null, ahora)).toBe(p);
    expect(verificarTotp(secreto, codigoTotp(secreto, p - 1), null, ahora)).toBe(p - 1);
    expect(verificarTotp(secreto, codigoTotp(secreto, p + 1), null, ahora)).toBe(p + 1);
    expect(verificarTotp(secreto, codigoTotp(secreto, p - 2), null, ahora)).toBeNull();
    expect(verificarTotp(secreto, codigoTotp(secreto, p), p, ahora)).toBeNull(); // ya usado
    for (const mal of ['', '12345', '1234567', 'abcdef', ' 123456']) expect(verificarTotp(secreto, mal, null, ahora)).toBeNull();
  });

  it('el secreto guardado solo se descifra con la misma clave', () => {
    const clave = 'una-clave-de-prueba-de-mas-de-32-caracteres';
    const guardado = cifrarSecreto(secreto, clave);
    expect(guardado).not.toContain(secreto);
    expect(descifrarSecreto(guardado, clave)).toBe(secreto);
    expect(() => descifrarSecreto(guardado, `${clave}x`)).toThrow();
    expect(() => descifrarSecreto(guardado.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), clave)).toThrow();
  });
});
