import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  try {
    console.log('🔄 Running email reports migration...\n');

    // Read migration file
    const migrationPath = resolve(__dirname, '../../../migrations/002_add_email_reports_config.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Remove comments (lines starting with --)
    const cleanedSQL = migrationSQL
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('--');
      })
      .join('\n');

    // Split by semicolons, but be careful with multi-line statements
    const statements: string[] = [];
    let currentStatement = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < cleanedSQL.length; i++) {
      const char = cleanedSQL[i];
      const nextChar = cleanedSQL[i + 1];

      currentStatement += char;

      // Track quotes
      if ((char === '"' || char === "'") && (i === 0 || cleanedSQL[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = '';
        }
      }

      // If we hit a semicolon and we're not in quotes, it's the end of a statement
      if (char === ';' && !inQuotes) {
        const trimmed = currentStatement.trim();
        if (trimmed.length > 0 && trimmed !== ';') {
          statements.push(trimmed);
        }
        currentStatement = '';
      }
    }

    // Add any remaining statement
    if (currentStatement.trim().length > 0) {
      statements.push(currentStatement.trim());
    }

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement && statement.trim() && !statement.trim().startsWith('COMMENT')) {
        try {
          console.log(`  [${i + 1}/${statements.length}] Executing statement...`);
          await query(statement);
          console.log(`  ✅ Statement ${i + 1} executed successfully\n`);
        } catch (error: any) {
          // Ignore "already exists" errors (for CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS)
          if (error.message && (
            error.message.includes('already exists') ||
            error.message.includes('duplicate key') ||
            error.message.includes('relation') && error.message.includes('already exists')
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
    console.log('\n📋 Created tables:');
    console.log('   - email_reports_config');
    console.log('   - email_reports_log');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
