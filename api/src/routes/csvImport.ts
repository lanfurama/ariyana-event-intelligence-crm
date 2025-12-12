import { Router, Request, Response } from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { detectDataIssues, calculateDataQualityScore, extractOrganizationName, type OrganizationData } from '../utils/dataQuality.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: resolve(__dirname, '../../../.env') });

const router = Router();

// Configure multer for CSV file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || 
        file.mimetype === 'text/plain' ||
        file.originalname.endsWith('.csv') ||
        file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files (.csv, .txt) are allowed'));
    }
  },
});

// Helper function to clean and normalize a single value
function cleanValue(value: any): any {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'string') {
    // Trim whitespace
    let cleaned = value.trim();
    
    // Remove zero-width characters and other invisible characters
    cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    // Remove BOM (Byte Order Mark) if present
    if (cleaned.charCodeAt(0) === 0xFEFF) {
      cleaned = cleaned.slice(1);
    }
    
    // Normalize empty strings to null
    if (cleaned === '' || cleaned === 'N/A' || cleaned === 'n/a' || cleaned === 'NULL' || cleaned === 'null' || cleaned === '-') {
      return null;
    }
    
    // Remove excessive whitespace (multiple spaces/tabs/newlines)
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Remove quotes if present (CSV often has quoted values)
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1);
    }
    
    return cleaned;
  }
  
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) {
      return null;
    }
    return value;
  }
  
  return value;
}

// Helper function to clean field names
function cleanFieldName(fieldName: string): string {
  return fieldName.trim()
    .replace(/[^\w\s]/g, '') // Remove special chars except word chars and spaces
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

// Parse CSV with proper handling
function parseCSV(csvText: string): { rows: any[]; headers: string[] } {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  if (lines.length === 0) {
    return { rows: [], headers: [] };
  }
  
  // Parse header
  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => cleanFieldName(h.trim()));
  
  // Parse data rows
  const rows: any[] = [];
  const seenRows = new Set<string>(); // Track duplicates
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple CSV parsing (handles quoted values)
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim()); // Add last value
    
    // Map values to headers
    const row: any = {};
    headers.forEach((header, idx) => {
      const value = values[idx];
      row[header] = cleanValue(value);
    });
    
    // Skip if all values are null/empty
    const hasData = Object.values(row).some(v => v !== null && v !== undefined);
    if (!hasData) continue;
    
    // Create hash for duplicate detection
    const rowHash = JSON.stringify(Object.entries(row).slice(0, 3));
    if (seenRows.has(rowHash)) {
      continue; // Skip duplicate
    }
    seenRows.add(rowHash);
    
    rows.push(row);
  }
  
  return { rows, headers };
}

// POST /api/csv-import/upload - Upload and process CSV file
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('📊 [CSV Import] Processing file:', req.file.originalname);
    console.log('📊 [CSV Import] File size:', req.file.size, 'bytes');
    console.log('📊 [CSV Import] MIME type:', req.file.mimetype);

    // Read CSV file as text
    const csvText = req.file.buffer.toString('utf-8');
    
    // Clean BOM if present
    const cleanText = csvText.charCodeAt(0) === 0xFEFF ? csvText.slice(1) : csvText;
    
    // Parse CSV
    const { rows, headers } = parseCSV(cleanText);
    
    console.log(`✅ [CSV Import] Parsed ${rows.length} rows with ${headers.length} columns`);
    console.log(`📊 [CSV Import] Headers:`, headers);

    // Extract organizations and detect data issues
    const organizations: OrganizationData[] = [];
    const seenNames = new Set<string>();
    
    rows.forEach((row: any) => {
      const orgName = extractOrganizationName(row);
      if (!orgName || orgName === 'N/A') {
        return; // Skip rows without valid organization name
      }
      
      // Check for duplicates (case-insensitive)
      const nameKey = orgName.toLowerCase().trim();
      if (seenNames.has(nameKey)) {
        return; // Skip duplicates
      }
      seenNames.add(nameKey);
      
      // Detect data issues
      const issues = detectDataIssues(row, orgName);
      const dataQualityScore = calculateDataQualityScore(row, issues);
      
      organizations.push({
        name: orgName,
        rawData: row,
        issues,
        dataQualityScore,
        hasContactInfo: issues.filter(i => i.field === 'contact' && i.severity === 'critical').length === 0,
        hasLocationInfo: issues.filter(i => i.field === 'location' && i.severity === 'critical').length === 0,
        hasEventInfo: issues.filter(i => i.field === 'delegates' || i.field === 'events').length < 2,
      });
    });
    
    console.log(`✅ [CSV Import] Extracted ${organizations.length} unique organizations`);
    console.log(`📊 [CSV Import] Organizations with data issues: ${organizations.filter(o => o.issues.length > 0).length}`);

    // Convert to text format for AI analysis
    const textData = rows
      .slice(0, 1000) // Limit to first 1000 rows
      .map((row, idx) => {
        const rowData = Object.entries(row)
          .filter(([key, value]) => value !== null && value !== undefined)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        return `Row ${idx + 1}: ${rowData}`;
      })
      .filter(line => line.length > 10)
      .join('\n');

    const summary = {
      totalRows: rows.length,
      totalColumns: headers.length,
      columns: headers,
    };

    res.json({
      success: true,
      summary,
      preview: rows.slice(0, Math.min(50, rows.length)), // First 50 rows as preview
      organizations: organizations.map(org => ({
        name: org.name,
        dataQualityScore: org.dataQualityScore,
        issues: org.issues,
        hasContactInfo: org.hasContactInfo,
        hasLocationInfo: org.hasLocationInfo,
        hasEventInfo: org.hasEventInfo,
        rawData: org.rawData, // Include raw data for analysis
      })),
      textData, // Cleaned text data ready for AI analysis
      message: `Successfully processed ${rows.length} rows from CSV file. Found ${organizations.length} organizations.`,
    });
  } catch (error: any) {
    console.error('❌ [CSV Import] Error:', error);
    res.status(500).json({
      error: error.message || 'Failed to process CSV file',
      details: error.stack,
    });
  }
});

export default router;

