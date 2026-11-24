import { Logger, ServiceUnavailableException, type ArgumentsHost } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Env } from '../config/env';
import { Prisma } from '../generated/prisma/client';
import { EvidenceStorage } from '../orders/evidence.storage';
import { ApiExceptionFilter } from './filters/api-exception.filter';

describe('base de datos lenta o disco sin permiso', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('una transacción vencida responde 503 con un mensaje claro, no «Error interno del servidor»', () => {
    for (const code of ['P2028', 'P2024']) {
      const json = jest.fn();
      const res = { headersSent: false, status: jest.fn(() => ({ json })) };
      const host = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({}) }) } as unknown as ArgumentsHost;
      new ApiExceptionFilter(10).catch(new Prisma.PrismaClientKnownRequestError('expired transaction', { code, clientVersion: 'x' }), host);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Probá de nuevo') }));
    }
  });

  it('si la carpeta de evidencias no se puede usar, avisa en lugar de dar un error interno', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'st-evidencias-'));
    try {
      // Un archivo donde tendría que haber una carpeta: no se puede crear nada adentro
      writeFileSync(join(dir, 'uploads'), '');
      const storage = new EvidenceStorage({ get: () => join(dir, 'uploads') } as unknown as ConfigService<Env, true>);
      await expect(storage.save('orden1', Buffer.from('x'), 'image/png')).rejects.toBeInstanceOf(ServiceUnavailableException);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
