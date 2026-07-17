// SECURITY: All Gemini API calls now go through backend API
// API keys are stored server-side only, never exposed to frontend

// Always use /api/v1 - works in both dev (via vite-plugin-api) and production
import { authHeaders } from './apiService';

const API_BASE_URL = '/api/v1';

/** Structured extraction of a pasted venue-inquiry email (AI intake). */
export interface RfpExtraction {
  is_rfp: boolean;
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  event_type?: string;
  expected_guests?: number;
  preferred_date?: string;
  layout?: string;
  summary?: string;
}

// Helper function for API calls
async function geminiApiCall<T>(endpoint: string, body: any): Promise<T> {
  try {
    console.log(`🔵 [Gemini Service] Calling backend API: ${API_BASE_URL}/gemini${endpoint}`);
    const response = await fetch(`${API_BASE_URL}/gemini${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error(`❌ [Gemini Service] API error (${response.status}):`, error);

      // Preserve retryDelay and isRateLimit from backend response
      const apiError: any = new Error(error.error || `HTTP error! status: ${response.status}`);
      if (error.retryDelay) apiError.retryDelay = error.retryDelay;
      if (error.isRateLimit) apiError.isRateLimit = true;
      throw apiError;
    }

    const result = await response.json();
    console.log(`✅ [Gemini Service] API call successful`);
    return result;
  } catch (error: any) {
    // Handle network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error(`❌ [Gemini Service] Network error: ${API_BASE_URL}/gemini${endpoint}`, error);
      const isDevelopment = import.meta.env.DEV;
      if (isDevelopment) {
        throw new Error(
          `Cannot connect to API server at ${API_BASE_URL}. Please make sure you're running 'npm run dev' which includes the backend API.`,
        );
      } else {
        throw new Error(
          `Cannot connect to API server. Please ensure the backend API is deployed and accessible.`,
        );
      }
    }
    throw error;
  }
}

// Helper: Extract retry delay from rate limit error
export const extractRetryDelay = (error: any): number | null => {
  try {
    // Check error message for retry delay
    const errorMessage = error.message || JSON.stringify(error);
    const retryMatch = errorMessage.match(/Please retry in ([\d.]+)s/i);
    if (retryMatch && retryMatch[1]) {
      return Math.ceil(parseFloat(retryMatch[1]));
    }

    // Check error details for RetryInfo
    if (error.details) {
      for (const detail of error.details) {
        if (detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' && detail.retryDelay) {
          const delayStr = detail.retryDelay;
          const secondsMatch = delayStr.match(/(\d+)s/);
          if (secondsMatch) {
            return parseInt(secondsMatch[1]);
          }
        }
      }
    }

    // Check error.error for RetryInfo
    if (error.error?.details) {
      for (const detail of error.error.details) {
        if (detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' && detail.retryDelay) {
          const delayStr = detail.retryDelay;
          const secondsMatch = delayStr.match(/(\d+)s/);
          if (secondsMatch) {
            return parseInt(secondsMatch[1]);
          }
        }
      }
    }
  } catch (e) {
    console.error('Error parsing retry delay:', e);
  }
  return null;
};

// Helper: Check if error is rate limit error
export const isRateLimitError = (error: any): boolean => {
  if (error.isRateLimit === true) return true;

  const errorMessage = error.message || JSON.stringify(error);
  return (
    errorMessage.includes('429') ||
    errorMessage.includes('RESOURCE_EXHAUSTED') ||
    errorMessage.includes('quota') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('Please retry in')
  );
};

// Helper: Retry operation for transient XHR/Network errors
const retryOperation = async <T>(fn: () => Promise<T>, retries = 3): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      if (i > 0) {
        console.log(`🔄 [Gemini Service] Retry attempt ${i + 1}/${retries}`);
      }
      return await fn();
    } catch (error: any) {
      console.error(`❌ [Gemini Service] Attempt ${i + 1} failed:`, error.message || error);

      // Don't retry rate limit errors - let UI handle countdown
      if (isRateLimitError(error)) {
        console.warn('⚠️  [Gemini Service] Rate limit error detected - not retrying');
        throw error;
      }

      // If last retry, throw
      if (i === retries - 1) {
        console.error(`❌ [Gemini Service] All ${retries} attempts failed`);
        throw error;
      }

      // Check for network/RPC errors (code 6, fetch failed, etc.)
      const msg = error.message || '';
      if (
        msg.includes('error code: 6') ||
        msg.includes('fetch failed') ||
        msg.includes('Rpc failed') ||
        msg.includes('503') ||
        msg.includes('timeout') ||
        msg.includes('network')
      ) {
        const waitTime = 1000 * (i + 1);
        console.warn(
          `⏳ [Gemini Service] Network error detected. Waiting ${waitTime}ms before retry...`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime)); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw new Error('Operation failed after retries');
};

// Helper: Clean JSON string from markdown fences
const cleanJson = (text: string) => {
  if (!text) return '{}';
  return text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();
};

// --- Email Drafting ---
export const draftSalesEmail = async (
  leadName: string,
  leadCompany: string,
  leadTitle: string,
  eventContext: string,
) => {
  console.log('🔵 [Gemini Service] draftSalesEmail - Calling backend API');

  return geminiApiCall<{ subject: string; body: string }>('/draft-email', {
    leadName,
    leadCompany,
    leadTitle,
    eventContext,
  });
};

/** Parse a pasted venue-inquiry email into a structured booking request (AI intake). */
export const parseRfp = async (text: string): Promise<RfpExtraction> => {
  return geminiApiCall<RfpExtraction>('/parse-rfp', { text });
};

// Chat / video-analysis / strategic-analysis wrappers were removed 2026-07-16
// with the email-marketing refocus (their views are gone). The backend routes
// still exist; restore a thin wrapper here if a feature returns.
