import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type CsvRecord = {
  'Company Name'?: string;
  Contacts?: string;
  Email?: string;
  Country?: string;
};

const csvPath = path.resolve(__dirname, '../Portfolio_Database_with_Country.csv');
const outPath = path.resolve(__dirname, './import_summer_beach_2026_leads.sql');

const content = fs.readFileSync(csvPath, 'utf8');

const records = parse(content, {
  columns: true,
  skip_empty_lines: true,
}) as CsvRecord[];

const domainToCompany = new Map<string, string>();

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const values: string[] = [];

const MAX_ID_LENGTH = 50;
const DEFAULT_INDUSTRY = 'General / Unknown';
const DEFAULT_INDUSTRY_SQL = `'${DEFAULT_INDUSTRY.replace(/'/g, "''")}'`;

function buildId(companyName: string, index: number): string {
  const prefix = 'sb26-';
  const baseSlug = slugify(companyName) || `lead-${index + 1}`;
  const numericSuffix = String(index + 1).padStart(3, '0');
  // pattern: sb26-<slug>-<nnn>
  const maxSlugLen =
    MAX_ID_LENGTH - prefix.length - 1 /* dash before suffix */ - numericSuffix.length;
  const trimmedSlug =
    baseSlug.length > maxSlugLen ? baseSlug.slice(0, maxSlugLen) : baseSlug;
  return `${prefix}${trimmedSlug}-${numericSuffix}`;
}

records.forEach((rec, index) => {
  const rawCompany = (rec['Company Name'] || '').trim();
  const contacts = (rec.Contacts || '').trim();
  const email = (rec.Email || '').trim();
  const country = (rec.Country || '').trim() || null;

  let companyName = rawCompany || '';

  const emailDomain = email.includes('@') ? email.split('@')[1]!.toLowerCase().trim() : '';
  if (companyName && emailDomain) {
    domainToCompany.set(emailDomain, companyName);
  }

  if (!companyName && emailDomain && domainToCompany.has(emailDomain)) {
    companyName = domainToCompany.get(emailDomain)!;
  }

  if (!companyName && contacts) {
    companyName = contacts;
  }

  if (!companyName && email) {
    companyName = email.split('@')[0]!;
  }

  if (!companyName) {
    companyName = `Summer Beach Lead ${index + 1}`;
  }

  const id = buildId(companyName, index);

  const companySql = companyName.replace(/'/g, "''");
  const contactDisplay = (contacts || companyName).trim();
  const contactsSql = contactDisplay ? contactDisplay.replace(/'/g, "''") : companySql;
  const emailSql = email ? email.replace(/'/g, "''") : null;
  const countrySql = country ? country.replace(/'/g, "''") : null;
  const notes = 'Portfolio summer beach 2026 lead';

  const notesSql = notes.replace(/'/g, "''");

  const row = [
    `'${id}'`, // id
    `'${companySql}'`, // company_name
    DEFAULT_INDUSTRY_SQL, // industry (NOT NULL)
    countrySql ? `'${countrySql}'` : 'NULL', // country
    `'Da Nang'`, // city
    'NULL', // website
    `'${contactsSql}'`, // key_person_name (NOT NULL)
    'NULL', // key_person_title
    emailSql ? `'${emailSql}'` : 'NULL', // key_person_email
    'NULL', // key_person_phone
    'NULL', // key_person_linkedin
    '0', // total_events
    '0', // vietnam_events
    `'${notesSql}'`, // notes
    `'New'`, // status
    'NULL', // last_contacted
    'NULL', // past_events_history
    'NULL', // research_notes
    'NULL', // secondary_person_name
    'NULL', // secondary_person_title
    'NULL', // secondary_person_email
    'NULL', // number_of_delegates
    'NULL', // lead_score
    'NULL', // last_score_update
    `'SUMMER_BEACH_2026'`, // type
    'CURRENT_TIMESTAMP', // created_at
    'CURRENT_TIMESTAMP', // updated_at
  ];

  values.push(`    (${row.join(', ')})`);
});

const header = `-- Import Portfolio Database leads for Summer Beach 2026
-- Source: Portfolio_Database_with_Country.csv
-- Type: SUMMER_BEACH_2026

-- Total: ${records.length} leads

INSERT INTO leads (
    id, company_name, industry, country, city, website,
    key_person_name, key_person_title, key_person_email, key_person_phone, key_person_linkedin,
    total_events, vietnam_events, notes, status, last_contacted,
    past_events_history, research_notes, secondary_person_name, secondary_person_title,
    secondary_person_email, number_of_delegates, lead_score, last_score_update, type,
    created_at, updated_at
) VALUES
`;

const sql = `${header}${values.join(',\n')};

-- Total: ${records.length} SUMMER_BEACH_2026 leads
`;

fs.writeFileSync(outPath, sql, 'utf8');

console.log(`Generated SQL with ${records.length} leads at ${outPath}`);

