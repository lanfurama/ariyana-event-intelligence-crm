import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration(migrationFile: string) {
  try {
    const migrationPath = resolve(__dirname, '../../../migrations', migrationFile);
    if (!existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    console.log(`🔄 Running migration: ${migrationFile}\n`);

    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    const cleanedSQL = migrationSQL
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('--');
      })
      .join('\n');

    const statements: string[] = [];
    let currentStatement = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < cleanedSQL.length; i++) {
      const char = cleanedSQL[i];
      currentStatement += char;

      if ((char === '"' || char === "'") && (i === 0 || cleanedSQL[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = '';
        }
      }

      if (char === ';' && !inQuotes) {
        const trimmed = currentStatement.trim();
        if (trimmed.length > 0 && trimmed !== ';') {
          statements.push(trimmed);
        }
        currentStatement = '';
      }
    }

    if (currentStatement.trim().length > 0) {
      statements.push(currentStatement.trim());
    }

    console.log(`📝 Found ${statements.length} SQL statement(s)\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement && statement.trim() && !statement.trim().startsWith('COMMENT')) {
        try {
          console.log(`  [${i + 1}/${statements.length}] Executing...`);
          const result = await query(statement);
          const rows = (result as { rowCount?: number }).rowCount ?? 0;
          console.log(`  ✅ Statement ${i + 1} OK${rows >= 0 ? ` (${rows} rows affected)` : ''}\n`);
        } catch (error: any) {
          if (error.message && (
            error.message.includes('already exists') ||
            error.message.includes('duplicate key') ||
            (error.message.includes('relation') && error.message.includes('already exists'))
          )) {
            console.log(`  ⚠️  Statement ${i + 1} skipped (already exists)\n`);
          } else {
            console.error(`  ❌ Error in statement ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
    }

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: tsx runMigrationGeneric.ts <migration_file>');
  console.error('Example: tsx runMigrationGeneric.ts 005_fix_leads_status_from_email_logs.sql');
  process.exit(1);
}

runMigration(migrationFile);
