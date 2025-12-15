// Event Scoring Utilities - Logic to score and filter events

export interface EventScore {
  totalScore: number;
  historyScore: number;
  regionScore: number;
  contactScore: number;
  delegatesScore: number;
  notes: string;
  problems: string[];
}

/**
 * Validate email format using regex
 */
function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate phone format - basic check for phone-like strings
 */
function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const phoneStr = phone.trim();
  // Remove common phone formatting characters
  const cleaned = phoneStr.replace(/[\s\-\(\)\+]/g, '');
  // Check if it contains at least 7 digits (minimum for a valid phone number)
  return /^\d{7,}$/.test(cleaned);
}

/**
 * Calculate history score based on Vietnam and Southeast Asia events
 */
function calculateHistoryScore(editions: any[]): number {
  if (!editions || editions.length === 0) return 0;
  
  let vietnamCount = 0;
  let seaCount = 0;
  
  const seaCountries = ['vietnam', 'thailand', 'singapore', 'malaysia', 'indonesia', 'philippines', 'myanmar', 'cambodia', 'laos', 'brunei'];
  
  editions.forEach((edition: any) => {
    const country = String(edition.COUNTRY || edition.Country || edition.country || '').toLowerCase().trim();
    
    if (country === 'vietnam' || country === 'vn') {
      vietnamCount++;
    } else if (seaCountries.includes(country)) {
      seaCount++;
    }
  });
  
  if (vietnamCount >= 1) return 25;
  if (seaCount >= 1) return 15;
  return 0;
}

/**
 * Calculate region score based on event name and locations
 */
function calculateRegionScore(eventName: string, editions: any[]): number {
  const nameLower = (eventName || '').toLowerCase();
  
  // Check if name contains region keywords
  if (nameLower.includes('asean') || nameLower.includes('asia') || nameLower.includes('pacific') || nameLower.includes('apac') || nameLower.includes('eastern')) {
    return 25;
  }
  
  // Check if events are in Asian countries
  if (editions && editions.length > 0) {
    const asianCountries = ['china', 'japan', 'korea', 'india', 'thailand', 'singapore', 'malaysia', 'indonesia', 'philippines', 'vietnam', 'taiwan', 'hong kong', 'south korea', 'north korea', 'sri lanka', 'bangladesh', 'pakistan', 'myanmar', 'cambodia', 'laos', 'brunei'];
    
    for (const edition of editions) {
      const country = String(edition.COUNTRY || edition.Country || edition.country || '').toLowerCase().trim();
      // Use exact match or check if country string equals or starts with Asian country name
      // This avoids false positives like "united kingdom" matching "kingdom"
      if (asianCountries.some(ac => {
        // Exact match
        if (country === ac) return true;
        // Country name contains full Asian country name (e.g., "south korea" contains "korea")
        if (country.includes(ac) && ac.length >= 4) return true; // Only match if Asian country name is at least 4 chars to avoid short matches
        // Asian country name contains country (e.g., "hong kong" contains "hong")
        if (ac.includes(country) && country.length >= 4) return true;
        return false;
      })) {
        return 15;
      }
    }
  }
  
  return 0;
}

/**
 * Calculate contact score based on available contact information
 */
function calculateContactScore(eventData: any, relatedContacts: any[] = []): number {
  let hasEmail = false;
  let hasPhone = false;
  let hasName = false;
  
  // Check in event data
  const emailFields = ['EMAIL', 'Email', 'email', 'keyPersonEmail', 'CONTACT_EMAIL'];
  const phoneFields = ['PHONE', 'Phone', 'phone', 'keyPersonPhone', 'CONTACT_PHONE', 'TEL'];
  const nameFields = ['keyPersonName', 'CONTACT_NAME', 'Name', 'Contact Name'];
  
  for (const field of emailFields) {
    const emailValue = eventData[field];
    if (emailValue && isValidEmail(String(emailValue))) {
      hasEmail = true;
      break;
    }
  }
  
  for (const field of phoneFields) {
    const phoneValue = eventData[field];
    if (phoneValue && isValidPhone(String(phoneValue))) {
      hasPhone = true;
      break;
    }
  }
  
  for (const field of nameFields) {
    const nameValue = eventData[field];
    if (nameValue && String(nameValue).trim().length > 0) {
      hasName = true;
      break;
    }
  }
  
  // Check in related contacts
  if (!hasEmail || !hasPhone || !hasName) {
    relatedContacts.forEach((contact: any) => {
      const contactEmail = contact.EMAIL || contact.Email || contact.email || contact.keyPersonEmail;
      const contactPhone = contact.PHONE || contact.Phone || contact.phone || contact.keyPersonPhone;
      const contactName = contact.NAME || contact.Name || contact.name || contact.keyPersonName;
      
      if (contactEmail && isValidEmail(String(contactEmail))) hasEmail = true;
      if (contactPhone && isValidPhone(String(contactPhone))) hasPhone = true;
      if (contactName && String(contactName).trim().length > 0) hasName = true;
    });
  }
  
  // Improved scoring: 25 = email+phone, 20 = email+name, 15 = email only, 10 = name only, 0 = nothing
  if (hasEmail && hasPhone) return 25;
  if (hasEmail && hasName) return 20;
  if (hasEmail) return 15;
  if (hasName) return 10;
  return 0;
}

/**
 * Calculate delegates score based on attendance numbers
 * Uses average delegates instead of max to better reflect typical event size
 */
function calculateDelegatesScore(editions: any[]): number {
  if (!editions || editions.length === 0) return 0;
  
  const delegateFields = ['TOTATTEND', 'REGATTEND', 'Delegates', 'Attendees', 'Attendance', 'DELEGATES', 'ATTENDEES'];
  
  const delegateValues: number[] = [];
  
  editions.forEach((edition: any) => {
    for (const field of delegateFields) {
      const value = edition[field];
      if (value !== null && value !== undefined) {
        const numValue = Number(value);
        if (!isNaN(numValue) && isFinite(numValue) && numValue > 0) {
          delegateValues.push(numValue);
          break; // Only count one value per edition
        }
      }
    }
  });
  
  if (delegateValues.length === 0) return 0;
  
  // Calculate average delegates
  const sum = delegateValues.reduce((acc, val) => acc + val, 0);
  const averageDelegates = Math.round(sum / delegateValues.length);
  
  // Score based on average (more representative than max)
  if (averageDelegates >= 500) return 25;
  if (averageDelegates >= 300) return 20;
  if (averageDelegates >= 100) return 10;
  return 0;
}

/**
 * Format event history from editions
 */
export function formatEventHistory(editions: any[]): string {
  if (!editions || editions.length === 0) {
    return '';
  }
  
  const historyItems: string[] = [];
  
  editions.forEach((edition: any) => {
    const year = extractFieldValue(edition, ['Year', 'YEAR', 'Event Year', 'Date', 'EVENT_DATE']);
    const city = extractFieldValue(edition, ['City', 'CITY', 'Location City', 'LOCATION_CITY', 'Venue City']);
    const country = extractFieldValue(edition, ['Country', 'COUNTRY', 'Location Country', 'LOCATION_COUNTRY', 'Venue Country']);
    const delegates = extractFieldValue(edition, ['TOTATTEND', 'REGATTEND', 'Delegates', 'Attendees', 'Attendance']);
    
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
      const location = [city, country].filter(Boolean).join(', ');
      if (location) {
        historyItems.push(location);
      }
    }
  });
  
  return historyItems.join('; ');
}

/**
 * Extract field value from data
 */
function extractFieldValue(row: any, fieldNames: string[]): string | null {
  for (const field of fieldNames) {
    if (row[field] && typeof row[field] === 'string' && row[field].trim().length > 0) {
      return String(row[field]).trim();
    }
    
    const fieldKey = Object.keys(row).find(k =>
      k.toLowerCase() === field.toLowerCase() &&
      row[k] &&
      typeof row[k] === 'string' &&
      String(row[k]).trim().length > 0
    );
    
    if (fieldKey) {
      return String(row[fieldKey]).trim();
    }
    
    if (row[field] !== null && row[field] !== undefined) {
      const numValue = Number(row[field]);
      if (!isNaN(numValue) && isFinite(numValue)) {
        return String(numValue);
      }
    }
  }
  
  return null;
}

/**
 * Calculate total score for an event
 */
export function calculateEventScore(
  eventName: string,
  eventData: any,
  editions: any[] = [],
  relatedContacts: any[] = []
): EventScore {
  const historyScore = calculateHistoryScore(editions);
  const regionScore = calculateRegionScore(eventName, editions);
  const contactScore = calculateContactScore(eventData, relatedContacts);
  const delegatesScore = calculateDelegatesScore(editions);
  
  const totalScore = historyScore + regionScore + contactScore + delegatesScore;
  
  // Generate notes
  const notesParts: string[] = [];
  if (historyScore >= 25) notesParts.push('Has Vietnam events');
  else if (historyScore >= 15) notesParts.push('Has Southeast Asia events');
  
  if (regionScore >= 25) notesParts.push('Regional event (ASEAN/Asia/Pacific)');
  else if (regionScore >= 15) notesParts.push('Asian location');
  
  if (delegatesScore >= 25) notesParts.push('Large event (500+ delegates)');
  else if (delegatesScore >= 20) notesParts.push('Medium event (300+ delegates)');
  else if (delegatesScore >= 10) notesParts.push('Small event (100+ delegates)');
  
  // Generate problems
  const problems: string[] = [];
  if (contactScore === 0) problems.push('Missing contact information');
  else if (contactScore < 25 && contactScore >= 20) problems.push('Missing phone number');
  else if (contactScore < 20 && contactScore >= 15) problems.push('Missing phone number and contact name');
  else if (contactScore < 15 && contactScore >= 10) problems.push('Missing email and phone number');
  
  if (delegatesScore === 0) problems.push('No delegate count data');
  
  if (historyScore === 0 && regionScore === 0) problems.push('No Asia/Vietnam history');
  
  const notes = notesParts.length > 0 ? notesParts.join(', ') : 'Standard event';
  
  return {
    totalScore,
    historyScore,
    regionScore,
    contactScore,
    delegatesScore,
    notes,
    problems
  };
}

