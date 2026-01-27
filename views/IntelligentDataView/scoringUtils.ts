/**
 * Scoring utility functions for event analysis
 * These functions calculate scores based on different criteria
 */

/**
 * Calculate history score based on Vietnam/SEA events
 * @param editions Array of event editions
 * @returns Score from 0-25
 */
export const calculateHistoryScore = (editions: any[]): number => {
  if (!editions || editions.length === 0) return 0;

  let vietnamCount = 0;
  let seaCount = 0;

  const seaCountries = [
    'vietnam',
    'thailand',
    'singapore',
    'malaysia',
    'indonesia',
    'philippines',
    'myanmar',
    'cambodia',
    'laos',
    'brunei',
  ];

  editions.forEach((edition: any) => {
    // ICCA format: COUNTRY, CITY are uppercase
    const country = String(
      edition.COUNTRY || edition.Country || edition.country || ''
    ).toLowerCase().trim();
    const city = String(edition.CITY || edition.City || edition.city || '').toLowerCase().trim();

    if (
      country === 'vietnam' ||
      country === 'vn' ||
      city.includes('hanoi') ||
      city.includes('ho chi minh') ||
      city.includes('danang') ||
      city.includes('saigon')
    ) {
      vietnamCount++;
    } else if (seaCountries.includes(country)) {
      seaCount++;
    }
  });

  if (vietnamCount >= 1) return 25;
  if (seaCount >= 1) return 15;
  return 0;
};

/**
 * Calculate region score based on Asia/Pacific relevance
 * @param eventName Name of the event
 * @param editions Array of event editions
 * @returns Score from 0-25
 */
export const calculateRegionScore = (eventName: string, editions: any[]): number => {
  const nameLower = (eventName || '').toLowerCase();

  if (
    nameLower.includes('asean') ||
    nameLower.includes('asia') ||
    nameLower.includes('pacific') ||
    nameLower.includes('apac') ||
    nameLower.includes('eastern')
  ) {
    return 25;
  }

  if (editions && editions.length > 0) {
    const asianCountries = [
      'china',
      'japan',
      'korea',
      'india',
      'thailand',
      'singapore',
      'malaysia',
      'indonesia',
      'philippines',
      'vietnam',
      'taiwan',
      'hong kong',
      'south korea',
      'north korea',
      'sri lanka',
      'bangladesh',
      'pakistan',
      'myanmar',
      'cambodia',
      'laos',
      'brunei',
    ];

    for (const edition of editions) {
      const country = String(
        edition.COUNTRY || edition.Country || edition.country || ''
      ).toLowerCase().trim();
      // Use exact match or check if country string equals or starts with Asian country name
      // This avoids false positives like "united kingdom" matching "kingdom"
      if (
        asianCountries.some((ac) => {
          // Exact match
          if (country === ac) return true;
          // Country name contains full Asian country name (e.g., "south korea" contains "korea")
          if (country.includes(ac) && ac.length >= 4) return true; // Only match if Asian country name is at least 4 chars to avoid short matches
          // Asian country name contains country (e.g., "hong kong" contains "hong")
          if (ac.includes(country) && country.length >= 4) return true;
          return false;
        })
      ) {
        return 15;
      }
    }
  }

  return 0;
};

/**
 * Validate email format
 * @param email Email string to validate
 * @returns true if valid email format
 */
export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Validate phone number format
 * @param phone Phone string to validate
 * @returns true if valid phone format
 */
export const isValidPhone = (phone: string): boolean => {
  if (!phone || typeof phone !== 'string') return false;
  const phoneStr = phone.trim();
  // Remove common phone formatting characters
  const cleaned = phoneStr.replace(/[\s\-\(\)\+]/g, '');
  // Check if it contains at least 7 digits (minimum for a valid phone number)
  return /^\d{7,}$/.test(cleaned);
};

/**
 * Calculate contact score based on email/phone/name availability
 * @param eventData Event data object
 * @param relatedContacts Related contacts from org_contacts sheet
 * @returns Score from 0-25
 */
export const calculateContactScore = (
  eventData: any,
  relatedContacts: any[] = []
): number => {
  let hasEmail = false;
  let hasPhone = false;
  let hasName = false;

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

  if (!hasEmail || !hasPhone || !hasName) {
    relatedContacts.forEach((contact: any) => {
      const contactEmail =
        contact.EMAIL ||
        contact.Email ||
        contact.email ||
        contact.keyPersonEmail;
      const contactPhone =
        contact.PHONE ||
        contact.Phone ||
        contact.phone ||
        contact.keyPersonPhone;
      const contactName =
        contact.NAME || contact.Name || contact.name || contact.keyPersonName;

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
};

/**
 * Calculate delegates score based on event size
 * @param editions Array of event editions
 * @returns Score from 0-25
 */
export const calculateDelegatesScore = (editions: any[]): number => {
  if (!editions || editions.length === 0) return 0;

  const delegateFields = [
    'TOTATTEND',
    'REGATTEND',
    'Delegates',
    'Attendees',
    'Attendance',
    'DELEGATES',
    'ATTENDEES',
  ];

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

  // Calculate average delegates (more representative than max)
  const sum = delegateValues.reduce((acc, val) => acc + val, 0);
  const averageDelegates = Math.round(sum / delegateValues.length);

  // Ariyana Convention Centre sweet spot: 200-800 delegates
  // Too small or too large events are penalized
  if (averageDelegates >= 200 && averageDelegates <= 800) {
    return 25; // Perfect fit for Ariyana capacity
  } else if (
    (averageDelegates >= 150 && averageDelegates < 200) ||
    (averageDelegates > 800 && averageDelegates <= 1000)
  ) {
    return 20; // Acceptable but not ideal
  } else if (
    (averageDelegates >= 100 && averageDelegates < 150) ||
    (averageDelegates > 1000 && averageDelegates <= 1500)
  ) {
    return 10; // Too small or too large
  } else {
    return 0; // Not suitable (<100 or >1500)
  }
};

/**
 * Extract field value from row using multiple possible field names
 * @param row Data row object
 * @param fieldNames Array of possible field names to try
 * @returns Field value or null
 */
const extractFieldValue = (row: any, fieldNames: string[]): string | null => {
  for (const field of fieldNames) {
    const value = row[field];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return null;
};

/**
 * Format event history from editions
 * @param editions Array of event editions
 * @returns Formatted history string
 */
export const formatEventHistory = (editions: any[]): string => {
  if (!editions || editions.length === 0) {
    return '';
  }

  const historyItems: string[] = [];
  const countriesSet = new Set<string>();

  editions.forEach((edition: any) => {
    // Extract year - check multiple field names
    const year = extractFieldValue(edition, [
      'EDITYEARS',
      'EditYears',
      'edityears',
      'STARTDATE',
      'StartDate',
      'startDate',
      'Year',
      'YEAR',
      'year',
      'Event Year',
      'EVENT_YEAR',
      'Date',
      'DATE',
      'EVENT_DATE',
    ]);

    // Extract city
    const city = extractFieldValue(edition, [
      'CITY',
      'City',
      'city',
      'Location City',
      'LOCATION_CITY',
      'Venue City',
      'VENUE_CITY',
    ]);

    // Extract country - critical for rotation rule
    const country = extractFieldValue(edition, [
      'COUNTRY',
      'Country',
      'country',
      'Location Country',
      'LOCATION_COUNTRY',
      'Venue Country',
      'VENUE_COUNTRY',
    ]);

    // Extract delegates count - critical for size rule
    const delegates = extractFieldValue(edition, [
      'TOTATTEND',
      'TotAttend',
      'totattend',
      'REGATTEND',
      'RegAttend',
      'regattend',
      'Delegates',
      'DELEGATES',
      'delegates',
      'Attendees',
      'ATTENDEES',
      'attendees',
      'Attendance',
      'ATTENDANCE',
    ]);

    // Track unique countries for rotation analysis
    if (country) {
      countriesSet.add(country.toLowerCase().trim());
    }

    // Format: "2023: City, Country (500 delegates)" or "2023: City, Country"
    let item = '';
    if (year) {
      item = year;
      if (city || country) {
        const location = [city, country].filter(Boolean).join(', ');
        item += `: ${location}`;
      }
      if (delegates) {
        item += ` (${delegates} onsite delegates)`;
      }
      historyItems.push(item);
    } else if (city || country) {
      const location = [city, country].filter(Boolean).join(', ');
      if (location) {
        historyItems.push(location);
      }
    }
  });

  // Add summary for AI: distinct countries count (critical for rotation rule)
  const historyString = historyItems.join('; ');
  const distinctCountries = Array.from(countriesSet);
  const countriesCount = distinctCountries.length;

  if (countriesCount > 0) {
    return `${historyString} | DISTINCT COUNTRIES: ${countriesCount} (${distinctCountries.join(', ')})`;
  }

  return historyString;
};
