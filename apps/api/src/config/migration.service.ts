import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);
  private readonly appliedLogKey = 'migration:applied';

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

    // Get already applied migrations from Redis
    let applied: string[] = [];
    try {
      const stored = await this.prisma.$queryRawUnsafe(
        `SELECT value FROM system_settings WHERE key = 'migration:applied'`,
      ) as any[];
      if (stored.length > 0) {
        applied = JSON.parse(stored[0].value);
      }
    } catch {
      // system_settings table may not exist yet
      applied = [];
    }

    for (const file of files) {
      if (applied.includes(file)) {
        this.logger.log(`Migration ${file} already applied, skipping`);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));

      this.logger.log(`Applying migration: ${file} (${statements.length} statements)`);

      const transaction: string[] = [];
      for (const stmt of statements) {
        if (stmt.toUpperCase().startsWith('ALTER') || stmt.toUpperCase().startsWith('CREATE') || stmt.toUpperCase().startsWith('DROP') || stmt.toUpperCase().startsWith('UPDATE')) {
          transaction.push(stmt);
        }
      }

      try {
        for (const stmt of transaction) {
          await this.prisma.$executeRawUnsafe(`${stmt};`);
        }

        // Record as applied
        applied.push(file);
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO system_settings (key, value) VALUES ('migration:applied', $1::text)
           ON CONFLICT (key) DO UPDATE SET value = $1::text`,
          JSON.stringify(applied),
        );

        this.logger.log(`Migration ${file} applied successfully`);
      } catch (err) {
        this.logger.error(`Migration ${file} failed: ${err.message}`);
        // Don't throw — allow app to continue, tsvector will fall back to ILIKE
      }
    }
  }
}
