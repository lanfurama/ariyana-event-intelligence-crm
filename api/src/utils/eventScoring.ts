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
  if (nameLower.includes('asean') || nameLower.includes('asia') || nameLower.includes('pacific') || nameLower.includes('apac')) {
    return 25;
  }
  
  // Check if events are in Asian countries
  if (editions && editions.length > 0) {
    const asianCountries = ['china', 'japan', 'korea', 'india', 'thailand', 'singapore', 'malaysia', 'indonesia', 'philippines', 'vietnam', 'taiwan', 'hong kong'];
    
    for (const edition of editions) {
      const country = String(edition.COUNTRY || edition.Country || edition.country || '').toLowerCase().trim();
      if (asianCountries.some(ac => country.includes(ac) || ac.includes(country))) {
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
  
  // Check in event data
  const emailFields = ['EMAIL', 'Email', 'email', 'keyPersonEmail', 'CONTACT_EMAIL'];
  const phoneFields = ['PHONE', 'Phone', 'phone', 'keyPersonPhone', 'CONTACT_PHONE', 'TEL'];
  
  for (const field of emailFields) {
    if (eventData[field] && String(eventData[field]).trim() && String(eventData[field]).includes('@')) {
      hasEmail = true;
      break;
    }
  }
  
  for (const field of phoneFields) {
    if (eventData[field] && String(eventData[field]).trim()) {
      hasPhone = true;
      break;
    }
  }
  
  // Check in related contacts
  if (!hasEmail || !hasPhone) {
    relatedContacts.forEach((contact: any) => {
      const contactEmail = contact.EMAIL || contact.Email || contact.email || contact.keyPersonEmail;
      const contactPhone = contact.PHONE || contact.Phone || contact.phone || contact.keyPersonPhone;
      
      if (contactEmail && String(contactEmail).includes('@')) hasEmail = true;
      if (contactPhone && String(contactPhone).trim()) hasPhone = true;
    });
  }
  
  if (hasEmail && hasPhone) return 25;
  if (hasEmail) return 15;
  return 0;
}

/**
 * Calculate delegates score based on attendance numbers
 */
function calculateDelegatesScore(editions: any[]): number {
  if (!editions || editions.length === 0) return 0;
  
  const delegateFields = ['TOTATTEND', 'REGATTEND', 'Delegates', 'Attendees', 'Attendance', 'DELEGATES', 'ATTENDEES'];
  
  let maxDelegates = 0;
  
  editions.forEach((edition: any) => {
    for (const field of delegateFields) {
      const value = edition[field];
      if (value !== null && value !== undefined) {
        const numValue = Number(value);
        if (!isNaN(numValue) && isFinite(numValue) && numValue > maxDelegates) {
          maxDelegates = numValue;
        }
      }
    }
  });
  
  if (maxDelegates >= 500) return 25;
  if (maxDelegates >= 300) return 20;
  if (maxDelegates >= 100) return 10;
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
  else if (contactScore < 25) problems.push('Missing phone number');
  
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

