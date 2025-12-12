// SECURITY: All Gemini API calls now go through backend API
// API keys are stored server-side only, never exposed to frontend

// Always use /api/v1 - works in both dev (via vite-plugin-api) and production
const API_BASE_URL = '/api/v1';

// Helper function for API calls
async function geminiApiCall<T>(endpoint: string, body: any): Promise<T> {
  try {
    console.log(`🔵 [Gemini Service] Calling backend API: ${API_BASE_URL}/gemini${endpoint}`);
    const response = await fetch(`${API_BASE_URL}/gemini${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
        throw new Error(`Cannot connect to API server at ${API_BASE_URL}. Please make sure you're running 'npm run dev' which includes the backend API.`);
      } else {
        throw new Error(`Cannot connect to API server. Please ensure the backend API is deployed and accessible.`);
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
  return errorMessage.includes('429') || 
         errorMessage.includes('RESOURCE_EXHAUSTED') ||
         errorMessage.includes('quota') ||
         errorMessage.includes('rate limit') ||
         errorMessage.includes('Please retry in');
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
      if (msg.includes('error code: 6') || msg.includes('fetch failed') || msg.includes('Rpc failed') || msg.includes('503') || msg.includes('timeout') || msg.includes('network')) {
         const waitTime = 1000 * (i + 1);
         console.warn(`⏳ [Gemini Service] Network error detected. Waiting ${waitTime}ms before retry...`);
         await new Promise(resolve => setTimeout(resolve, waitTime)); // Exponential backoff
         continue;
      }
      throw error;
    }
  }
  throw new Error("Operation failed after retries");
};

// Helper: Clean JSON string from markdown fences
const cleanJson = (text: string) => {
  if (!text) return "{}";
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- 1. Data Enrichment via Google Search ---
export const enrichLeadData = async (companyName: string, keyPerson: string, city: string) => {
  // Validate inputs
  if (!companyName || companyName.trim() === '') {
    throw new Error("Company name is required for data enrichment");
  }

  console.log('🔵 [Gemini Service] enrichLeadData - Calling backend API');
  
  return geminiApiCall<{ text: string; grounding: any }>('/enrich', {
    companyName: companyName.trim(),
    keyPerson: keyPerson.trim() || '',
    city: city.trim() || '',
  });
};

// --- 2. Email Drafting ---
export const draftSalesEmail = async (
  leadName: string, 
  leadCompany: string, 
  leadTitle: string,
  eventContext: string
) => {
  console.log('🔵 [Gemini Service] draftSalesEmail - Calling backend API');
  
  return geminiApiCall<{ subject: string; body: string }>('/draft-email', {
    leadName,
    leadCompany,
    leadTitle,
    eventContext,
  });
};

// --- 3. Chat Assistant ---
export const sendChatMessage = async (history: {role: string, parts: {text: string}[]}[], message: string) => {
  console.log('🔵 [Gemini Service] sendChatMessage - Calling backend API');
  
  const result = await geminiApiCall<{ text: string }>('/chat', {
    history,
    message,
  });
  
  return result.text;
};

// --- 4. Video Analysis ---
export const analyzeVideoContent = async (base64Data: string, mimeType: string) => {
  console.log('🔵 [Gemini Service] analyzeVideoContent - Calling backend API');
  
  const result = await geminiApiCall<{ text: string }>('/analyze-video', {
    base64Data,
    mimeType,
  });
  
  return result.text;
};

// --- 5. Veo Video Generation ---
// Note: Veo video generation is not currently implemented in backend
// This feature requires special API access and is not commonly used
// If needed, can be added to backend API later

export const generatePromoVideo = async (prompt: string, aspectRatio: '16:9' | '9:16' = '16:9') => {
  throw new Error('Video generation is not currently available. This feature requires backend implementation.');
};

export const pollVideoOperation = async (operation: any) => {
  throw new Error('Video generation is not currently available. This feature requires backend implementation.');
};

// --- 6. Strategic Analysis (Intelligent Data) ---
export const generateStrategicAnalysis = async (leadsData: string) => {
  console.log('🔵 [Gemini Service] generateStrategicAnalysis - Calling backend API');
  console.log('📝 [Gemini Service] Data length:', leadsData.length, 'characters');
  console.log('⏱️  [Gemini Service] Start time:', new Date().toISOString());
  
  const apiStartTime = Date.now();
  
  try {
    const result = await geminiApiCall<{ text: string }>('/strategic-analysis', {
      leadsData,
    });
    
    const apiTime = Date.now() - apiStartTime;
    console.log(`✅ [Gemini Service] API call completed in ${(apiTime / 1000).toFixed(2)}s`);
    console.log('📄 [Gemini Service] Response received, length:', result.text?.length || 0);
    
    return result.text;
  } catch (error: any) {
    const apiTime = Date.now() - apiStartTime;
    console.error(`❌ [Gemini Service] API call failed after ${(apiTime / 1000).toFixed(2)}s`);
    console.error('❌ [Gemini Service] Error:', error);
    console.error('❌ [Gemini Service] Error details:', JSON.stringify(error, null, 2));
    
    // Check if error has retryDelay from backend response
    if (error.retryDelay) {
      const retryError: any = new Error(error.message || 'Rate limit exceeded');
      retryError.retryDelay = error.retryDelay;
      retryError.isRateLimit = true;
      throw retryError;
    }
    
    // Also check if it's a rate limit error from status code
    if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('quota')) {
      const retryError: any = new Error(error.message || 'Rate limit exceeded');
      retryError.isRateLimit = true;
      // Try to extract retry delay from error message
      const retryMatch = error.message?.match(/Please retry in ([\d.]+)s/i);
      if (retryMatch && retryMatch[1]) {
        retryError.retryDelay = Math.ceil(parseFloat(retryMatch[1]));
      }
      throw retryError;
    }
    
    throw error;
  }
};