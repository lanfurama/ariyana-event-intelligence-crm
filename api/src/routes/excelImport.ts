import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { detectDataIssues, calculateDataQualityScore, extractOrganizationName, extractEventName, type OrganizationData } from '../utils/dataQuality.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: resolve(__dirname, '../../../.env') });

const router = Router();

// Configure multer for file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel.sheet.macroEnabled.12', // .xlsm
    ];
    if (allowedTypes.includes(file.mimetype) || 
        file.originalname.endsWith('.xls') || 
        file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xls, .xlsx) are allowed'));
    }
  },
});

// Helper to get Gemini client
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not found in environment variables');
  }
  return new GoogleGenAI({ apiKey });
};

// Helper function to clean and normalize a single value
function cleanValue(value: any): any {
  if (value === null || value === undefined) {
    return null;
  }
  
  // Convert to string for processing
  if (typeof value === 'string') {
    // Trim whitespace
    let cleaned = value.trim();
    
    // Remove zero-width characters and other invisible characters
    cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    // Normalize empty strings to null
    if (cleaned === '' || cleaned === 'N/A' || cleaned === 'n/a' || cleaned === 'NULL' || cleaned === 'null') {
      return null;
    }
    
    // Remove excessive whitespace (multiple spaces/tabs)
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    return cleaned;
  }
  
  // Handle numbers - ensure they're valid
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) {
      return null;
    }
    return value;
  }
  
  // Handle dates - convert to ISO string if it's a Date object
  if (value instanceof Date) {
    return value.toISOString().split('T')[0]; // YYYY-MM-DD format
  }
  
  // Handle boolean
  if (typeof value === 'boolean') {
    return value;
  }
  
  // For other types, convert to string and clean
  return cleanValue(String(value));
}

// Helper function to clean field names
function cleanFieldName(fieldName: string): string {
  // Remove special characters, normalize spaces
  let cleaned = fieldName.trim()
    .replace(/[^\w\s]/g, '') // Remove special chars except word chars and spaces
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
  
  // Convert to PascalCase for consistency (optional - can keep original)
  // For now, just normalize spaces and trim
  return cleaned;
}

// Helper function to format event history from editions
function formatEventHistory(editions: any[]): string {
  if (!editions || editions.length === 0) {
    return '';
  }
  
  const historyItems: string[] = [];
  
  editions.forEach((edition: any) => {
    // ICCA format: EDITYEARS, STARTDATE, ENDDATE, CITY, COUNTRY, TOTATTEND, REGATTEND
    const year = extractFieldValue(edition, ['EDITYEARS', 'EditYears', 'edityears', 'STARTDATE', 'StartDate', 'startDate', 'Year', 'YEAR', 'Event Year', 'Date', 'EVENT_DATE']);
    const city = extractFieldValue(edition, ['CITY', 'City', 'city', 'Location City', 'LOCATION_CITY', 'Venue City']);
    const country = extractFieldValue(edition, ['COUNTRY', 'Country', 'country', 'Location Country', 'LOCATION_COUNTRY', 'Venue Country']);
    const delegates = extractFieldValue(edition, ['TOTATTEND', 'TotAttend', 'totattend', 'REGATTEND', 'RegAttend', 'regattend', 'registeredDelegate', 'Delegates', 'Attendees', 'Attendance']);
    
    // Format: "2023: City, Country (500 delegates)" or "2023: City, Country"
    let item = '';
    if (year) {
      item = year;
      if (city || country) {
        const location = [city, country].filter(Boolean).join(', ');
        item += `: ${location}`;
      }
      if (delegates) {
        item += ` (${delegates} delegates)`;
      }
      historyItems.push(item);
    } else if (city || country) {
      // If no year, still include location
      const location = [city, country].filter(Boolean).join(', ');
      if (location) {
        historyItems.push(location);
      }
    }
  });
  
  return historyItems.join('; ');
}

// Helper function to extract field value (case-insensitive)
function extractFieldValue(row: any, fieldNames: string[]): string | null {
  for (const field of fieldNames) {
    // Try exact match
    if (row[field] && typeof row[field] === 'string' && row[field].trim().length > 0) {
      return String(row[field]).trim();
    }
    
    // Try case-insensitive match
    const fieldKey = Object.keys(row).find(k => 
      k.toLowerCase() === field.toLowerCase() && 
      row[k] && 
      typeof row[k] === 'string' && 
      String(row[k]).trim().length > 0
    );
    if (fieldKey) {
      return String(row[fieldKey]).trim();
    }
    
    // Try number fields (for year, delegates)
    if (row[field] !== null && row[field] !== undefined) {
      const numValue = Number(row[field]);
      if (!isNaN(numValue) && isFinite(numValue)) {
        return String(numValue);
      }
    }
  }
  
  return null;
}

// Data cleaning function with comprehensive data normalization
function cleanExcelData(workbook: XLSX.WorkBook): {
  cleanedData: any[];
  summary: {
    totalSheets: number;
    totalRows: number;
    sheets: { name: string; rows: number; columns: string[] }[];
  };
} {
  const sheets: { name: string; rows: number; columns: string[] }[] = [];
  const allData: any[] = [];
  const seenRows = new Set<string>(); // Track duplicates by content hash
  
  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    
    // Read with better options
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      defval: null, // Use null for empty cells
      raw: false, // Convert dates/numbers to strings/numbers
      dateNF: 'yyyy-mm-dd', // Date format
      blankrows: false, // Skip blank rows
    });
    
    if (jsonData.length > 0) {
      // Clean column names
      const firstRow = jsonData[0] as any;
      const columns = Object.keys(firstRow).map(cleanFieldName);
      
      sheets.push({
        name: sheetName,
        rows: jsonData.length,
        columns,
      });
      
      // Clean and normalize each row
      const enrichedData = jsonData
        .map((row: any) => {
          // Clean all values in the row
          const cleanedRow: any = { _sheet: sheetName };
          
          Object.entries(row).forEach(([key, value]) => {
            const cleanKey = cleanFieldName(key);
            cleanedRow[cleanKey] = cleanValue(value);
          });
          
          // Create a hash for duplicate detection (based on key fields)
          const rowHash = JSON.stringify({
            sheet: sheetName,
            // Use first few meaningful fields for hash
            data: Object.entries(cleanedRow)
              .filter(([k]) => k !== '_sheet')
              .slice(0, 5)
              .map(([k, v]) => `${k}:${v}`)
              .join('|')
          });
          
          // Skip if duplicate
          if (seenRows.has(rowHash)) {
            return null;
          }
          seenRows.add(rowHash);
          
          return cleanedRow;
        })
        .filter((row: any) => row !== null); // Remove nulls (duplicates)
      
      allData.push(...enrichedData);
    }
  });
  
  console.log(`🧹 [Data Cleaning] Cleaned ${allData.length} rows (removed duplicates and normalized values)`);
  
  return {
    cleanedData: allData,
    summary: {
      totalSheets: workbook.SheetNames.length,
      totalRows: allData.length,
      sheets,
    },
  };
}

// POST /api/excel-import/upload - Upload and process Excel file
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('📊 [Excel Import] Processing file:', req.file.originalname);
    console.log('📊 [Excel Import] File size:', req.file.size, 'bytes');
    console.log('📊 [Excel Import] MIME type:', req.file.mimetype);

    // Read Excel file
    const workbook = XLSX.read(req.file.buffer, {
      type: 'buffer',
      cellDates: true,
      cellNF: false,
      cellText: false,
    });

    console.log('📊 [Excel Import] Sheets found:', workbook.SheetNames);

    // Clean and process data
    const { cleanedData, summary } = cleanExcelData(workbook);

    console.log('✅ [Excel Import] Cleaned data:', summary.totalRows, 'rows from', summary.totalSheets, 'sheets');

    // Filter to only Editions sheet for preview (for event parsing)
    // Priority: "Editions" sheet first, then any sheet with "edition" or "event" in name
    // Fallback: if no Editions sheet found, try "Orgs" sheet (for backward compatibility)
    let editionSheetName = workbook.SheetNames.find(name => 
      name.toLowerCase() === 'editions'
    ) || workbook.SheetNames.find(name => 
      name.toLowerCase().includes('edition') || 
      (name.toLowerCase().includes('event') && !name.toLowerCase().includes('contact'))
    );
    
    // Fallback: if no Editions sheet, try Orgs sheet (for backward compatibility)
    if (!editionSheetName) {
      editionSheetName = workbook.SheetNames.find(name => 
        name.toLowerCase() === 'orgs'
      ) || workbook.SheetNames.find(name => 
        name.toLowerCase().includes('org') && !name.toLowerCase().includes('contact') && !name.toLowerCase().includes('country')
      );
    }
    
    const editionData = editionSheetName 
      ? cleanedData.filter(row => (row._sheet || '').toLowerCase() === editionSheetName.toLowerCase())
      : cleanedData; // Fallback to all data if no edition/org sheet found
    
    console.log(`📊 [Excel Import] Available sheets:`, workbook.SheetNames.join(', '));
    console.log(`📊 [Excel Import] Using sheet: ${editionSheetName || 'All sheets (fallback)'}, ${editionData.length} rows`);
    console.log(`📊 [Excel Import] Total cleaned data: ${cleanedData.length} rows from ${summary.totalSheets} sheets`);

    // Extract events and detect data issues
    // Group editions by event name/series to build event history
    const eventsMap = new Map<string, {
      name: string;
      editions: any[];
      rawData: any;
      issues: any[];
      dataQualityScore: number;
      hasContactInfo: boolean;
      hasLocationInfo: boolean;
      hasEventInfo: boolean;
    }>();
    
    try {
      editionData.forEach((row: any) => {
        try {
          // Try extractEventName first (for Editions sheet)
          let eventName = extractEventName(row);
          
          // Fallback: if extractEventName fails, try extractOrganizationName (for Orgs sheet backward compatibility)
          if (!eventName || eventName === 'N/A') {
            eventName = extractOrganizationName(row);
          }
          
          if (!eventName || eventName === 'N/A') {
            return; // Skip rows without valid event/series name
          }
          
          // Use case-insensitive key for grouping
          const nameKey = eventName.toLowerCase().trim();
          
          // If event already exists, add this row as another edition
          if (eventsMap.has(nameKey)) {
            const existingEvent = eventsMap.get(nameKey)!;
            existingEvent.editions.push(row);
            return;
          }
          
          // New event - create entry
          // Extract organization name (different from event/series name)
          const organizationName = extractOrganizationName(row);
          
          console.log(`📊 [Excel Import] Event: "${eventName}" | Org: "${organizationName || 'N/A'}"`);
          if (!organizationName) {
            console.log(`⚠️ [Excel Import] No organization name found for event "${eventName}". Available fields:`, Object.keys(row).filter(k => k.toLowerCase().includes('org') || k.toLowerCase().includes('name')));
          }
          
          // Detect data issues (using event name instead of org name)
          const issues = detectDataIssues(row, eventName);
          const dataQualityScore = calculateDataQualityScore(row, issues);
          
          eventsMap.set(nameKey, {
            name: eventName,
            organizationName: organizationName || eventName, // Fallback to event name if no org name
            editions: [row], // Start with first edition
            rawData: row, // Keep first row as primary rawData
            issues,
            dataQualityScore,
            hasContactInfo: issues.filter(i => i.field === 'contact' && i.severity === 'critical').length === 0,
            hasLocationInfo: issues.filter(i => i.field === 'location' && i.severity === 'critical').length === 0,
            hasEventInfo: issues.filter(i => i.field === 'delegates' || i.field === 'events').length < 2,
          });
        } catch (rowError: any) {
          console.warn(`⚠️ [Excel Import] Error processing row:`, rowError.message);
          // Continue processing other rows
        }
      });
    } catch (extractError: any) {
      console.error('❌ [Excel Import] Error extracting events:', extractError);
      // Don't throw here - return empty events array instead
      console.warn('⚠️ [Excel Import] Continuing with empty events array');
    }
    
    // Convert map to array (using OrganizationData type for backward compatibility)
    const events: any[] = Array.from(eventsMap.values()).map(eventData => ({
      name: eventData.name,
      organizationName: eventData.organizationName, // Organization name (different from event name)
      rawData: eventData.rawData,
      issues: eventData.issues,
      dataQualityScore: eventData.dataQualityScore,
      hasContactInfo: eventData.hasContactInfo,
      hasLocationInfo: eventData.hasLocationInfo,
      hasEventInfo: eventData.hasEventInfo,
      editions: eventData.editions, // Add editions history
    }));
    
    console.log(`✅ [Excel Import] Extracted ${events.length} unique events`);
    console.log(`📊 [Excel Import] Events with data issues: ${events.filter(e => e.issues.length > 0).length}`);
    console.log(`📊 [Excel Import] Total editions across all events: ${events.reduce((sum, e) => sum + (e.editions?.length || 1), 0)}`);
    
    // Warn if no events found
    if (events.length === 0) {
      console.warn(`⚠️ [Excel Import] No events found. Available sheets: ${workbook.SheetNames.join(', ')}`);
    }

    // Convert to text format for AI analysis (include all sheets for context)
    // Additional cleaning: remove null values, format properly
    const textData = cleanedData
      .slice(0, 1000) // Limit to first 1000 rows to avoid token limits
      .map((row, idx) => {
        const rowData = Object.entries(row)
          .filter(([key]) => key !== '_sheet')
          .filter(([key, value]) => value !== null && value !== undefined) // Remove null/undefined
          .map(([key, value]) => {
            // Format value properly
            const cleanVal = value === null || value === undefined ? 'N/A' : String(value).trim();
            return `${key}: ${cleanVal}`;
          })
          .join(', ');
        return `Row ${idx + 1} (Sheet: ${row._sheet}): ${rowData}`;
      })
      .filter(line => line.length > 20) // Filter out empty or too short lines
      .join('\n');

    res.json({
      success: true,
      summary,
      preview: editionData.slice(0, Math.min(50, editionData.length)), // Only Editions sheet rows for preview
      events: events.map(event => {
        // Format event history from editions
        const eventHistory = event.editions && event.editions.length > 0 
          ? formatEventHistory(event.editions)
          : '';
        
        return {
          name: event.name,
          dataQualityScore: event.dataQualityScore,
          issues: event.issues,
          hasContactInfo: event.hasContactInfo,
          hasLocationInfo: event.hasLocationInfo,
          hasEventInfo: event.hasEventInfo,
          rawData: event.rawData, // Include raw data for analysis
          editions: event.editions || [], // Include all editions
          eventHistory: eventHistory, // Formatted history string
        };
      }),
      // Also provide organizations for backward compatibility
      organizations: events.map(event => {
        const eventHistory = event.editions && event.editions.length > 0 
          ? formatEventHistory(event.editions)
          : '';
        return {
          name: event.name,
          dataQualityScore: event.dataQualityScore,
          issues: event.issues,
          hasContactInfo: event.hasContactInfo,
          hasLocationInfo: event.hasLocationInfo,
          hasEventInfo: event.hasEventInfo,
          rawData: event.rawData,
          editions: event.editions || [],
          eventHistory: eventHistory,
        };
      }),
      textData, // Cleaned text data ready for AI analysis (all sheets for context)
      message: `Successfully processed ${summary.totalRows} rows from ${summary.totalSheets} sheets. Found ${events.length} events.`,
    });
  } catch (error: any) {
    console.error('❌ [Excel Import] Error:', error);
    res.status(500).json({
      error: error.message || 'Failed to process Excel file',
      details: error.stack,
    });
  }
});

// POST /api/excel-import/analyze - Analyze cleaned Excel data with AI
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { textData, summary } = req.body;

    if (!textData || textData.trim() === '') {
      return res.status(400).json({ error: 'Text data is required for analysis' });
    }

    console.log('🔵 [Excel Import] Starting AI analysis...');
    console.log('📝 [Excel Import] Data length:', textData.length, 'characters');

    const ai = getAiClient();
    const modelId = 'gemini-2.5-flash-lite';

    const prompt = `
Context: You are the Director of International Sales for Ariyana Convention Centre Danang, Vietnam (the venue that successfully hosted APEC 2017). Your goal is to analyze Excel data exported from ICCA (International Congress and Convention Association) Business Intelligence system and identify the best MICE leads to host their next conference in Danang in 2026 or 2027.

Input Data (Excel export with multiple sheets - Organizations, Editions, Contacts, Suppliers, etc.):
${textData}

File Summary: ${JSON.stringify(summary, null, 2)}

Task 1: Data Understanding
- Identify what type of data is in each sheet (Organizations, Events/Editions, Contacts, Suppliers, etc.)
- Understand the relationships between sheets (e.g., Organizations -> Editions -> Suppliers)
- Note any important fields like: Organization names, event dates, locations, contact information, delegate counts, etc.

Task 2: The Filtering Algorithm (Logic Step)
Analyze the data and identify "High Potential Leads" based on these criteria (NOTE: Scoring will be done by backend engine, you only need to identify potential leads):
- History: Events organized in Vietnam or Southeast Asia are high priority
- Region: Events with "ASEAN", "Asia", "Pacific", "Eastern" in name, or events in Asian countries, likely rotate within our region
- Contact: Events with valid contact information (email, phone, or contact person) are easier to pursue
- Event Size: Events with higher delegate/attendee count (>= 300) indicate larger events worth pursuing

Task 3: The Enrichment (Research Step) - AUTOMATIC DATA ENRICHMENT
For ALL leads identified in Task 2 (especially those with missing information):
- **CRITICAL**: If contact information is missing (email, phone, name), use your knowledge to search and find:
  - Key contact person name (President, Director, Secretary, etc.)
  - Contact email (official email or general contact format)
  - Phone number (if available)
  - Website URL (official website)
- If industry is missing or unclear, infer from organization name and event types
- If country/city is missing, infer from event locations or organization context
- Analyze their Industry or Organization type
- Check event patterns (frequency, rotation, locations)
- Estimate likelihood of rotating to Vietnam based on past patterns
- Note any decision makers or key contacts
- **IMPORTANT**: For organizations with missing contact info, actively search and provide the most likely contact information based on the organization's name, type, and your knowledge

Task 4: Output Generation
Please generate a report in the following format:

PART A: STRATEGIC ANALYSIS
Create a Markdown table with the top 5-10 leads ranked by priority:
| Rank | Organization | Event Series | Total Score | History Score | Region Score | Contact Score | Delegates Score | Score Reason | Next Step Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | [Name] | [Event name] | [0-100] | [0-25] | [0-25] | [0-25] | [0-25] | [e.g., Organized in Asia 3x, 500 delegates, annual rotation...] | [e.g., Propose for 2027...] |

IMPORTANT: For each lead, provide the data fields below. The backend scoring engine will automatically calculate scores based on:
- History Score (0-25): 25 if VN events >= 1, 15 if SEA events, 0 otherwise
- Region Score (0-25): 25 if name contains "ASEAN/Asia/Pacific/Eastern", 15 if Asian location, 0 otherwise
- Contact Score (0-25): 25 if has email+phone, 15 if email only, 0 otherwise
- Delegates Score (0-25): 25 if >= 500, 20 if >= 300, 10 if >= 100, 0 otherwise
- Total Score (0-100): Sum of all individual scores (calculated by backend)

You do NOT need to calculate scores - just provide accurate data fields. The backend will calculate scores automatically.

PART B: DATA INSIGHTS
- Total organizations analyzed: [count]
- Total events/editions found: [count]
- Geographic distribution: [summary]
- Industry breakdown: [summary]
- Key patterns identified: [list]

PART C: ACTIONABLE EMAILS
Draft 3 personalized emails for the Top 3 leads.

PART D: STRUCTURED DATA (JSON)
Crucial: Output the "High Potential Leads" identified in Task 2 as a valid JSON array so I can import them into my database.

**DATA ENRICHMENT REQUIREMENT**: 
- If any field is missing in the Excel data, you MUST use your knowledge to search and fill it in
- For missing contact info: Search for the organization's official website, find contact pages, and provide the most likely contact person and email
- For missing industry: Infer from organization name, event types, and subject categories
- For missing location: Infer from event locations or organization context
- DO NOT leave fields as null/empty if you can reasonably infer or find the information

Use this EXACT structure for each object:
{
  "companyName": "String (Organization name - REQUIRED)",
  "industry": "String (Infer from event type, organization name, or Series_Subjects - REQUIRED, do not leave empty)",
  "country": "String (From organization, event location, or infer from context - REQUIRED)",
  "city": "String (From organization, event location, or infer from context - REQUIRED)",
  "website": "String (Search and find official website URL if not in Excel - try to provide)",
  "keyPersonName": "String (From contacts sheet, or search for President/Director/Secretary if missing - try to provide)",
  "keyPersonTitle": "String (From contacts sheet, or infer common titles like 'President', 'Director', 'Secretary' - try to provide)",
  "keyPersonEmail": "String (From contacts sheet, or search for official contact email format - try to provide)",
  "keyPersonPhone": "String (From contacts sheet, or search if available - optional)",
  "vietnamEvents": Number (Count of events in Vietnam, if any, default 0),
  "totalEvents": Number (Total events found, default 1),
  "numberOfDelegates": Number (Average or max delegates from TOTATTEND/REGATTEND, if mentioned, default null)",
  "totalScore": Number (0-100, will be recalculated by backend scoring engine),
  "historyScore": Number (0-25, will be recalculated by backend scoring engine),
  "regionScore": Number (0-25, will be recalculated by backend scoring engine),
  "contactScore": Number (0-25, will be recalculated by backend scoring engine),
  "delegatesScore": Number (0-25, will be recalculated by backend scoring engine),
  "problems": ["Missing email", "No phone", "Unclear industry", "Missing location", "No website", "No contact person", "Incomplete event history"],
  "notes": "String (The Score Reason, key insights, and note if data was enriched)",
  "pastEventsHistory": "String (Event history summary from Editions sheet - format: '2023: City, Country; 2022: City, Country')",
  "nextStepStrategy": "String (Action plan from PART A table)",
  "status": "New"
}

CRITICAL: Include "problems" array listing ALL missing/incomplete data. Be specific (e.g., "Missing keyPersonEmail", "No numberOfDelegates data", "Industry unclear from name").

**ENRICHMENT NOTES**: 
- If you enriched any data (added contact info, website, etc.), add a note in the "notes" field like: "[AI Enriched: Contact info found via search]"
- Prioritize accuracy - if you're not confident about a piece of information, you can leave it but try your best to find it
- For contact emails, use common formats like: info@[org-domain], contact@[org-domain], or search for specific contact pages

CRITICAL: The JSON MUST be wrapped in \`\`\`json\`\`\` code blocks. 
Example format:
\`\`\`json
[
  {
    "companyName": "...",
    ...
  }
]
\`\`\`

DO NOT skip the JSON output. It is essential for data import.
`;

    console.log('🚀 [Excel Import] Calling Gemini API with data enrichment enabled...');
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        temperature: 0.3,
        topP: 0.95,
        topK: 40,
      },
    });

    const analysisResult = response.text || 'No analysis generated.';

    // Extract JSON from the response to check if we need additional enrichment
    const jsonMatch = analysisResult.match(/```json([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        const parsedLeads = JSON.parse(jsonMatch[1]);
        console.log(`📊 [Excel Import] Extracted ${parsedLeads.length} leads from AI analysis`);
        
        // Check for leads with missing critical information
        const leadsNeedingEnrichment = parsedLeads.filter((lead: any) => 
          !lead.keyPersonEmail || 
          !lead.website || 
          !lead.keyPersonName ||
          !lead.industry ||
          lead.industry === '' ||
          lead.country === '' ||
          lead.city === ''
        );
        
        if (leadsNeedingEnrichment.length > 0) {
          console.log(`🔍 [Excel Import] Found ${leadsNeedingEnrichment.length} leads that may need additional enrichment`);
          console.log('💡 [Excel Import] AI has attempted to enrich missing data based on organization knowledge');
          console.log('📝 [Excel Import] Check the "notes" field in each lead to see if data was enriched');
        } else {
          console.log('✅ [Excel Import] All leads have complete information (or AI has enriched missing fields)');
        }
      } catch (e) {
        console.warn('⚠️  [Excel Import] Could not parse JSON for enrichment check:', e);
      }
    }

    console.log('✅ [Excel Import] AI analysis completed with automatic data enrichment');

    res.json({
      success: true,
      analysis: analysisResult,
      message: 'Analysis completed successfully with automatic data enrichment',
    });
  } catch (error: any) {
    console.error('❌ [Excel Import] Analysis error:', error);
    res.status(500).json({
      error: error.message || 'Analysis failed',
      details: error.stack,
    });
  }
});

export default router;

