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

  /**
   * Extract table names from a SQL migration file by parsing ALTER TABLE / CREATE INDEX statements.
   */
  private extractReferencedTables(sql: string): string[] {
    const tables = new Set<string>();
    const patterns = [
      /ALTER\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi,
      /CREATE\s+(?:UNIQUE\s+)?INDEX\s+\w+\s+ON\s+(\w+)/gi,
      /DROP\s+TRIGGER\s+IF\s+EXISTS\s+\w+\s+ON\s+(\w+)/gi,
      /UPDATE\s+(\w+)/gi,
    ];
    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(sql)) !== null) {
        tables.add(match[1].toLowerCase());
      }
    }
    return Array.from(tables);
  }

  /**
   * Check if a table exists in the current database.
   */
  private async tableExists(tableName: string): Promise<boolean> {
    try {
      const result: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
        tableName,
      );
      return result[0]?.exists === true;
    } catch {
      return false;
    }
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

    // Get already applied migrations from database (if table exists)
    let applied: string[] = [];
    try {
      const settingsTableExists = await this.tableExists('system_settings');
      if (settingsTableExists) {
        const stored = await this.prisma.$queryRawUnsafe(
          `SELECT value FROM system_settings WHERE key = 'migration:applied'`,
        ) as any[];
        if (stored.length > 0) {
          applied = JSON.parse(stored[0].value);
        }
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

      // Check if referenced tables exist before running
      const referencedTables = this.extractReferencedTables(sql);
      if (referencedTables.length > 0) {
        const missingTables: string[] = [];
        for (const tbl of referencedTables) {
          if (!(await this.tableExists(tbl))) {
            missingTables.push(tbl);
          }
        }
        if (missingTables.length > 0) {
          this.logger.warn(
            `Migration ${file} skipped: referenced table(s) [${missingTables.join(', ')}] do not exist yet. ` +
            `This is expected on first deploy — Prisma schema must be synced first (pnpm db:push). ` +
            `The app will continue with ILIKE fallback search. ` +
            `To apply manually, run the migration SQL after Prisma schema is synced.`,
          );
          continue;
        }
      }

      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

      this.logger.log(`Applying migration: ${file} (${statements.length} statements)`);

      try {
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
          // system_settings table may not exist; that's OK
        }

        this.logger.log(`Migration ${file} applied successfully`);
      } catch (err) {
        this.logger.error(`Migration ${file} failed: ${err.message}`);
        // Don't throw — allow app to continue, tsvector will fall back to ILIKE
      }
    }
  }
}
