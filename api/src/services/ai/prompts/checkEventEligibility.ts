/**
 * /check-event-eligibility operation — assess Vietnam history, ICCA
 * qualification, and recency for an event. GPT-only.
 */

export interface CheckEventEligibilityArgs {
  eventName: string;
  eventData?: string;
  pastEventsHistory?: string;
  currentYear: number;
  fiveYearsAgo: number;
}

export interface EventEligibilityResult {
  eventName: string;
  hasVietnamHistory: boolean;
  vietnamHistoryDetails: string;
  isICCAQualified: boolean;
  iccaQualifiedReason: string;
  hasRecentActivity: boolean;
  mostRecentYear: number | null;
  yearsSinceLastEvent: number | null;
  isEligible: boolean;
  eligibilityReason: string;
  recommendation: 'proceed' | 'skip' | 'review';
}

/**
 * System message. Moved verbatim from gpt.ts.
 */
export const OPENAI_CHECK_EVENT_ELIGIBILITY_SYSTEM_MESSAGE =
  'You are an expert MICE industry analyst specializing in ICCA-qualified events and Vietnam market analysis. Provide factual, conservative assessments based on event data and industry knowledge.';

/**
 * Prompt builder. Moved verbatim from gpt.ts.
 */
export function buildOpenaiCheckEventEligibilityPrompt(args: CheckEventEligibilityArgs): string {
  const { eventName, eventData, pastEventsHistory, currentYear, fiveYearsAgo } = args;
  return `EVENT ELIGIBILITY CHECK FOR ARIYANA CONVENTION CENTRE
==================================================

EVENT TO CHECK:
- Event Name: ${eventName}
${eventData ? `- Event Data: ${eventData.substring(0, 1000)}` : ''}
${pastEventsHistory ? `- Past Events History: ${pastEventsHistory}` : ''}

TASK: Check 3 critical eligibility criteria for this event:

1. VIETNAM HISTORY CHECK:
   - Has this event been held in Vietnam before?
   - Check past events history for Vietnam locations (Ho Chi Minh City, Hanoi, Danang, etc.)
   - Return: true if event has been held in Vietnam, false otherwise

2. ICCA QUALIFIED CHECK:
   - Is this event ICCA (International Congress and Convention Association) qualified?
   - ICCA qualified events are typically:
     * International association meetings
     * Rotating conferences with international participation
     * Events with significant international delegate attendance
     * Events listed in ICCA database
   - Return: true if ICCA qualified, false otherwise

3. RECENT ACTIVITY CHECK (Last 5 Years):
   - Has this event occurred within the last 5 years (${fiveYearsAgo}-${currentYear})?
   - Check the most recent event year from pastEventsHistory
   - If no history provided, infer from event name/pattern
   - Return: true if event occurred in last 5 years, false if older or unknown

OUTPUT FORMAT:
Return valid JSON object:
{
  "eventName": "${eventName}",
  "hasVietnamHistory": true/false,
  "vietnamHistoryDetails": "Brief description of Vietnam events if any",
  "isICCAQualified": true/false,
  "iccaQualifiedReason": "Brief explanation why qualified or not",
  "hasRecentActivity": true/false,
  "mostRecentYear": [year number or null],
  "yearsSinceLastEvent": [number or null],
  "isEligible": true/false,
  "eligibilityReason": "Overall eligibility assessment and reason",
  "recommendation": "proceed" or "skip" or "review"
}

CRITICAL:
- Be factual and conservative - only return true if you have clear evidence
- If uncertain, return false and explain in reason fields
- Use your knowledge base to check ICCA qualification standards
- Check event history carefully for Vietnam locations`;
}

/**
 * Default conservative response used when JSON parsing fails. Moved from gpt.ts.
 */
export function defaultCheckEventEligibilityResponse(eventName: string): EventEligibilityResult {
  return {
    eventName,
    hasVietnamHistory: false,
    vietnamHistoryDetails: 'Unable to verify',
    isICCAQualified: false,
    iccaQualifiedReason: 'Unable to verify ICCA qualification',
    hasRecentActivity: false,
    mostRecentYear: null,
    yearsSinceLastEvent: null,
    isEligible: false,
    eligibilityReason: 'Unable to verify eligibility criteria',
    recommendation: 'review',
  };
}

/**
 * Parse OpenAI response. Falls back to a conservative default if JSON parse fails.
 */
export function parseCheckEventEligibilityResponse(
  content: string,
  eventName: string,
): EventEligibilityResult {
  try {
    return JSON.parse(content || '{}') as EventEligibilityResult;
  } catch (e) {
    console.error('Failed to parse GPT eligibility response as JSON:', e);
    return defaultCheckEventEligibilityResponse(eventName);
  }
}
