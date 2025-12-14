// Data Quality Assessment Utilities

export interface DataIssue {
  severity: 'critical' | 'warning' | 'info';
  field: string;
  message: string;
}

export interface OrganizationData {
  name: string;
  organizationName?: string; // Organization name (different from event name)
  rawData: any;
  issues: DataIssue[];
  dataQualityScore: number;
  hasContactInfo: boolean;
  hasLocationInfo: boolean;
  hasEventInfo: boolean;
  editions?: any[]; // History of editions for this event
}

/**
 * Detect data issues for an organization
 */
export function detectDataIssues(orgData: any, orgName: string): DataIssue[] {
  const issues: DataIssue[] = [];
  
  // Critical: Missing organization name
  if (!orgName || orgName.trim().length < 2) {
    issues.push({
      severity: 'critical',
      field: 'name',
      message: 'Missing or invalid organization name'
    });
  }
  
  // Critical: Missing contact information
  const hasEmail = hasValidEmail(orgData);
  const hasPhone = hasValidPhone(orgData);
  const hasContactPerson = hasContactPersonName(orgData);
  
  if (!hasEmail && !hasPhone && !hasContactPerson) {
    issues.push({
      severity: 'critical',
      field: 'contact',
      message: 'Missing all contact information (email, phone, contact person)'
    });
  } else {
    if (!hasEmail) {
      issues.push({
        severity: 'critical',
        field: 'email',
        message: 'Missing keyPersonEmail'
      });
    }
    if (!hasPhone) {
      issues.push({
        severity: 'warning',
        field: 'phone',
        message: 'Missing keyPersonPhone'
      });
    }
    if (!hasContactPerson) {
      issues.push({
        severity: 'warning',
        field: 'contactPerson',
        message: 'Missing keyPersonName'
      });
    }
  }
  
  // Critical: Missing location information
  const hasCountry = hasValidValue(orgData, ['country', 'Country', 'COUNTRY', 'Location Country']);
  const hasCity = hasValidValue(orgData, ['city', 'City', 'CITY', 'Location City']);
  
  if (!hasCountry && !hasCity) {
    issues.push({
      severity: 'critical',
      field: 'location',
      message: 'Missing location information (country, city)'
    });
  } else {
    if (!hasCountry) {
      issues.push({
        severity: 'warning',
        field: 'country',
        message: 'Missing country'
      });
    }
    if (!hasCity) {
      issues.push({
        severity: 'warning',
        field: 'city',
        message: 'Missing city'
      });
    }
  }
  
  // Warning: Missing industry
  const hasIndustry = hasValidValue(orgData, ['industry', 'Industry', 'INDUSTRY', 'Sector', 'Category']);
  if (!hasIndustry) {
    issues.push({
      severity: 'warning',
      field: 'industry',
      message: 'Missing or unclear industry'
    });
  }
  
  // Warning: Missing website
  const hasWebsite = hasValidWebsite(orgData);
  if (!hasWebsite) {
    issues.push({
      severity: 'warning',
      field: 'website',
      message: 'Missing website URL'
    });
  }
  
  // Info: Missing event information
  const hasDelegates = hasValidValue(orgData, ['numberOfDelegates', 'delegates', 'Delegates', 'TOTATTEND', 'REGATTEND'], true);
  const hasEvents = hasValidValue(orgData, ['totalEvents', 'events', 'Events', 'vietnamEvents'], true);
  
  if (!hasDelegates) {
    issues.push({
      severity: 'info',
      field: 'delegates',
      message: 'No numberOfDelegates data available'
    });
  }
  if (!hasEvents) {
    issues.push({
      severity: 'info',
      field: 'events',
      message: 'No event history data available'
    });
  }
  
  return issues;
}

/**
 * Calculate data quality score (0-100)
 */
export function calculateDataQualityScore(orgData: any, issues: DataIssue[]): number {
  let score = 100;
  
  // Deduct points based on issue severity
  issues.forEach(issue => {
    if (issue.severity === 'critical') {
      score -= 15; // Critical issues are heavily penalized
    } else if (issue.severity === 'warning') {
      score -= 5; // Warnings are moderately penalized
    } else if (issue.severity === 'info') {
      score -= 2; // Info issues are lightly penalized
    }
  });
  
  // Bonus points for having complete information
  if (hasValidEmail(orgData) && hasValidPhone(orgData) && hasContactPersonName(orgData)) {
    score += 5; // Bonus for complete contact info
  }
  
  if (hasValidValue(orgData, ['country']) && hasValidValue(orgData, ['city'])) {
    score += 5; // Bonus for complete location
  }
  
  if (hasValidWebsite(orgData)) {
    score += 3; // Bonus for having website
  }
  
  return Math.max(0, Math.min(100, score)); // Clamp between 0 and 100
}

/**
 * Check if organization has valid email
 */
function hasValidEmail(orgData: any): boolean {
  const emailFields = ['keyPersonEmail', 'email', 'Email', 'EMAIL', 'Contact Email', 'contact_email'];
  for (const field of emailFields) {
    const value = getFieldValue(orgData, field);
    if (value && typeof value === 'string' && isValidEmailFormat(value)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if organization has valid phone
 */
function hasValidPhone(orgData: any): boolean {
  const phoneFields = ['keyPersonPhone', 'phone', 'Phone', 'PHONE', 'Contact Phone', 'contact_phone', 'Tel', 'TEL'];
  for (const field of phoneFields) {
    const value = getFieldValue(orgData, field);
    if (value && typeof value === 'string' && value.trim().length >= 8) {
      return true;
    }
  }
  return false;
}

/**
 * Check if organization has contact person name
 */
function hasContactPersonName(orgData: any): boolean {
  const nameFields = ['keyPersonName', 'contactPerson', 'Contact Person', 'Contact Name', 'contact_name', 'Name', 'Contact'];
  for (const field of nameFields) {
    const value = getFieldValue(orgData, field);
    if (value && typeof value === 'string' && value.trim().length >= 2) {
      return true;
    }
  }
  return false;
}

/**
 * Check if organization has valid website
 */
function hasValidWebsite(orgData: any): boolean {
  const websiteFields = ['website', 'Website', 'WEBSITE', 'URL', 'url', 'Web', 'web'];
  for (const field of websiteFields) {
    const value = getFieldValue(orgData, field);
    if (value && typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
      return true;
    }
  }
  return false;
}

/**
 * Check if field has valid value
 */
function hasValidValue(orgData: any, fieldNames: string[], isNumber = false): boolean {
  for (const field of fieldNames) {
    const value = getFieldValue(orgData, field);
    if (value !== null && value !== undefined) {
      if (isNumber) {
        if (typeof value === 'number' && !isNaN(value) && value > 0) {
          return true;
        }
        if (typeof value === 'string' && !isNaN(Number(value)) && Number(value) > 0) {
          return true;
        }
      } else {
        if (typeof value === 'string' && value.trim().length >= 2) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Get field value (case-insensitive)
 */
function getFieldValue(orgData: any, fieldName: string): any {
  // Try exact match first
  if (orgData[fieldName] !== undefined) {
    return orgData[fieldName];
  }
  
  // Try case-insensitive match
  const fieldKey = Object.keys(orgData).find(k => 
    k.toLowerCase() === fieldName.toLowerCase()
  );
  
  if (fieldKey) {
    return orgData[fieldKey];
  }
  
  return null;
}

/**
 * Validate email format
 */
function isValidEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Extract organization name from data
 */
export function extractOrganizationName(row: any): string | null {
  // Priority order for organization name fields (ICCA standard uses "ORGNAME" for organization)
  const nameFields = [
    'ORGNAME', 'OrgName', 'NAME', 'Org Name', 'Organization', 'Organisation', 'Org', 
    'Name', 'Company Name', 'companyName', 'Organization Name',
    'Company', 'COMPANY', 'ORGANIZATION'
  ];
  
  for (const field of nameFields) {
    // Try exact match
    if (row[field] && typeof row[field] === 'string' && row[field].trim().length > 2) {
      return row[field].trim();
    }
    
    // Try case-insensitive match
    const fieldKey = Object.keys(row).find(k => 
      k.toLowerCase() === field.toLowerCase() && 
      row[k] && 
      typeof row[k] === 'string' && 
      row[k].trim().length > 2
    );
    if (fieldKey) {
      return String(row[fieldKey]).trim();
    }
  }
  
  // Fallback: look for first meaningful string value
  for (const [key, value] of Object.entries(row)) {
    if (key === '_sheet') continue;
    if (value && typeof value === 'string') {
      const strValue = String(value).trim();
      // Skip if it looks like metadata (ID, number, date, etc.)
      if (strValue.length > 3 && 
          !strValue.match(/^\d+$/) && 
          !strValue.match(/^\d{4}-\d{2}-\d{2}/) &&
          !strValue.includes('Row') &&
          !strValue.includes('Sheet') &&
          !strValue.toLowerCase().includes('event') &&
          !strValue.toLowerCase().includes('workshop') &&
          !strValue.toLowerCase().includes('congress') &&
          !strValue.toLowerCase().includes('meeting')) {
        return strValue;
      }
    }
  }
  
  return null;
}

/**
 * Extract event name from data (for Editions sheet)
 * CRITICAL: For ICCA Editions sheet, we MUST use SeriesName to group editions by series
 * Each series can have multiple editions (yearly occurrences)
 * We want to group all editions of the same series into ONE event
 */
export function extractEventName(row: any): string | null {
  // Priority order for event name fields
  // CRITICAL: For ICCA Editions sheet, "SeriesName" is the key field to group editions
  const nameFields = [
    'SeriesName', 'SERIESNAME', 'Series Name', 'Series', 'SERIES', // ICCA standard for grouping editions
    'EVENT', 'Event Name', 'Event', 'Event Series', 'Event Title',
    'Name', 'EventTitle', 'Title', 'Conference Name', 'Congress Name',
    'Meeting Name', 'Workshop Name'
  ];
  
  for (const field of nameFields) {
    // Try exact match
    if (row[field] && typeof row[field] === 'string' && row[field].trim().length > 2) {
      return row[field].trim();
    }
    
    // Try case-insensitive match
    const fieldKey = Object.keys(row).find(k => 
      k.toLowerCase() === field.toLowerCase() && 
      row[k] && 
      typeof row[k] === 'string' && 
      row[k].trim().length > 2
    );
    if (fieldKey) {
      return String(row[fieldKey]).trim();
    }
  }
  
  // Fallback: look for first meaningful string value that might be an event name
  // IMPORTANT: Skip fields that look like edition-specific data (ECODE, Edition ID, etc.)
  for (const [key, value] of Object.entries(row)) {
    if (key === '_sheet') continue;
    // Skip edition-specific fields
    if (key.toLowerCase().includes('ecode') || 
        key.toLowerCase().includes('edition') || 
        key.toLowerCase() === 'id') {
      continue;
    }
    
    if (value && typeof value === 'string') {
      const strValue = String(value).trim();
      // Skip if it looks like metadata (ID, number, date, etc.)
      if (strValue.length > 3 && 
          !strValue.match(/^\d+$/) && 
          !strValue.match(/^\d{4}-\d{2}-\d{2}/) &&
          !strValue.includes('Row') &&
          !strValue.includes('Sheet')) {
        return strValue;
      }
    }
  }
  
  return null;
}

