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
   * Split SQL into statements, respecting $$ dollar-quoting blocks
   * (so semicolons inside function bodies are NOT treated as statement separators).
   */
  private splitStatements(sql: string): string[] {
    const statements: string[] = [];
    let current = '';
    let inDollar = false;
    let dollarTag = '';

    for (let i = 0; i < sql.length; i++) {
      const ch = sql[i];

      if (!inDollar && ch === '$' && i + 1 < sql.length && sql[i + 1] === '$') {
        // Start of unlabeled dollar quote
        inDollar = true;
        dollarTag = '';
        current += '$$';
        i++; // skip second $
        continue;
      }

      if (inDollar) {
        current += ch;
        // Check for end of dollar quote: $tag$
        if (ch === '$') {
          // Look backwards for the matching tag
          if (dollarTag === '') {
            // Unlabeled $$ - check if this is the closing $$
            inDollar = false;
            dollarTag = '';
          } else {
            // Check if the accumulated tag matches
            const matchTag = dollarTag;
            if (current.endsWith('$' + matchTag + '$')) {
              inDollar = false;
              dollarTag = '';
            }
          }
        }
        if (ch !== '$' && dollarTag === '' && inDollar) {
          // Building the tag after $$ (e.g., $func$)
        }
        continue;
      }

      if (ch === ';') {
        const trimmed = current.trim();
        if (trimmed) {
          statements.push(trimmed);
        }
        current = '';
        continue;
      }

      current += ch;
    }

    // Last statement
    const trimmed = current.trim();
    if (trimmed) {
      statements.push(trimmed);
    }

    return statements;
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

      // Split into statements, respecting $$ dollar-quoting
      const statements = this.splitStatements(sql)
        .filter((s) => !s.startsWith('--') && !s.startsWith('/*'));

      this.logger.log(`Applying migration: ${file} (${statements.length} statements)`);

      try {
        for (const stmt of statements) {
          if (stmt.trim()) {
            await this.prisma.$executeRawUnsafe(stmt);
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
          this.logger.warn(
            `Migration ${file} deferred: referenced tables do not exist yet. ` +
            `Run 'pnpm db:push' first to sync Prisma schema, then restart the app. ` +
            `The app will continue with ILIKE fallback search in the meantime.`,
          );
        } else {
          this.logger.error(`Migration ${file} failed: ${msg}`);
        }
      }
    }
  }
}
