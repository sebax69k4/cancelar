import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { access, mkdir, rm, statfs, writeFile } from 'node:fs/promises';
import { join, posix, resolve, sep } from 'node:path';
import type { Env } from '../config/env';
import { EXTENSION_EVIDENCIA } from './evidence.signature';

/** Lugar libre que siempre queda en el disco: si se llena, se cae todo el sistema y no solo las evidencias. */
const RESERVA_DISCO = 100 * 1024 * 1024;

/**
 * Almacenamiento de evidencias en disco (UPLOAD_DIR/<ordenId>/<uuid>.<ext>).
 * Para la nube (S3, Azure Blob…) basta con reimplementar esta clase.
 */
@Injectable()
export class EvidenceStorage {
  private readonly root: string;

  constructor(config: ConfigService<Env, true>) {
    this.root = resolve(config.get('UPLOAD_DIR', { infer: true }));
  }

  /** La extensión sale del tipo ya verificado, nunca del nombre que mandó el usuario. */
  async save(ordenId: string, buffer: Buffer, mime: string): Promise<string> {
    const ext = EXTENSION_EVIDENCIA[mime];
    if (!ext) throw new Error(`Tipo de evidencia no admitido: ${mime}`);
    // El id viene de la base, pero igual no se acepta nada que pueda armar otra ruta
    if (!/^[A-Za-z0-9_-]+$/.test(ordenId)) throw new Error('Id de orden inválido para la ruta de evidencia');
    // Siempre con «/»: la ruta se guarda en la base y tiene que servir igual en Windows y Linux
    const rel = posix.join(ordenId, `${randomUUID()}${ext}`);
    await mkdir(join(this.root, ordenId), { recursive: true });
    await writeFile(join(this.root, rel), buffer);
    return rel;
  }

  /** Queda lugar en el disco para otro archivo (si el sistema no lo informa, se intenta igual). */
  async hayLugar(): Promise<boolean> {
    try {
      await mkdir(this.root, { recursive: true });
      const d = await statfs(this.root);
      return d.bavail * d.bsize > RESERVA_DISCO;
    } catch {
      return true;
    }
  }

  absolute(rel: string): string {
    const abs = resolve(this.root, rel);
    // Defensa en profundidad: nunca salir de la carpeta de uploads
    // (con el separador: «uploads-otra» empieza igual que «uploads» pero es otra carpeta)
    if (!abs.startsWith(this.root + sep)) throw new Error('Ruta de evidencia inválida');
    return abs;
  }

  async exists(rel: string): Promise<boolean> {
    try {
      await access(this.absolute(rel));
      return true;
    } catch {
      return false;
    }
  }

  async remove(rel: string): Promise<void> {
    await rm(this.absolute(rel), { force: true });
  }
}
