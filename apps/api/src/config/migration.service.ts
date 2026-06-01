import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.runPendingMigrations();
  }

  async runPendingMigrations() {
    const migrationsDir = path.join(__dirname, '..', '..', 'prisma', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      this.logger.log('No migrations directory found, skipping');
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      this.logger.log('No SQL migration files found');
      return;
    }

    // Get already applied migrations from system_settings (if table exists)
    let applied: string[] = [];
    try {
      const stored = await this.prisma.$queryRawUnsafe(
        `SELECT value FROM system_settings WHERE key = 'migration:applied'`,
      ) as any[];
      if (stored.length > 0) {
        applied = JSON.parse(stored[0].value);
      }
    } catch {
      applied = [];
    }

    for (const file of files) {
      if (applied.includes(file)) {
        this.logger.log(`Migration ${file} already applied, skipping`);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      // Split into individual statements, filter comments
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

      this.logger.log(`Applying migration: ${file} (${statements.length} statements)`);

      try {
        // Try to execute the migration
        for (const stmt of statements) {
          if (stmt) {
            await this.prisma.$executeRawUnsafe(`${stmt};`);
          }
        }

        // Record as applied
        applied.push(file);
        try {
          await this.prisma.$executeRawUnsafe(
            `INSERT INTO system_settings (key, value) VALUES ('migration:applied', $1::text)
             ON CONFLICT (key) DO UPDATE SET value = $1::text`,
            JSON.stringify(applied),
          );
        } catch {
          // system_settings table may not exist yet; skip recording
        }

        this.logger.log(`Migration ${file} applied successfully`);
      } catch (err) {
        const msg = err.message || String(err);
        if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('42P01')) {
          // Relation not found — Prisma schema hasn't been synced yet
          this.logger.warn(
            `Migration ${file} deferred: referenced tables do not exist yet. ` +
            `Run 'pnpm db:push' first to sync Prisma schema, then restart the app. ` +
            `The app will continue with ILIKE fallback search in the meantime.`,
          );
        } else {
          this.logger.error(`Migration ${file} failed: ${msg}`);
        }
        // Don't throw — app continues with ILIKE fallback
      }
    }
  }
}
