import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';
import { createPgAdapter } from './adapter';

/** Cliente Prisma inyectable (PostgreSQL vía @prisma/adapter-pg). */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: createPgAdapter(config.get('DATABASE_URL', { infer: true })),
      // Los 5 s que trae Prisma no alcanzan si la base está lejos o el servidor recién despierta
      transactionOptions: { maxWait: 15_000, timeout: 25_000 },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
