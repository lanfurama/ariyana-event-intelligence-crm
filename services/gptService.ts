// SECURITY: All GPT API calls now go through backend API
// API keys are stored server-side only, never exposed to frontend

// Always use /api/v1 - works in both dev (via vite-plugin-api) and production
const API_BASE_URL = '/api/v1';

// Helper function for API calls
async function gptApiCall<T>(endpoint: string, body: any): Promise<T> {
  try {
    console.log(`🟢 [GPT Service] Calling backend API: ${API_BASE_URL}/gpt${endpoint}`);
    const response = await fetch(`${API_BASE_URL}/gpt${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error(`❌ [GPT Service] API error (${response.status}):`, error);
      
      // Preserve retryDelay and isRateLimit from backend response
      const apiError: any = new Error(error.error || `HTTP error! status: ${response.status}`);
      if (error.retryDelay) apiError.retryDelay = error.retryDelay;
      if (error.isRateLimit) apiError.isRateLimit = true;
      throw apiError;
    }

    const result = await response.json();
    console.log(`✅ [GPT Service] API call successful`);
    return result;
  } catch (error: any) {
    // Handle network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error(`❌ [GPT Service] Network error: ${API_BASE_URL}/gpt${endpoint}`, error);
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
    const errorMessage = error.message || JSON.stringify(error);
    // OpenAI rate limit format: "Rate limit reached for requests"
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      // Default retry after 60 seconds for OpenAI
      return 60;
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
         errorMessage.includes('rate limit') ||
         errorMessage.includes('quota') ||
         errorMessage.includes('Rate limit reached');
};

// Helper: Retry operation for transient errors
const retryOperation = async <T>(fn: () => Promise<T>, retries = 3): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      if (i > 0) {
        console.log(`🔄 [GPT Service] Retry attempt ${i + 1}/${retries}`);
      }
      return await fn();
    } catch (error: any) {
      console.error(`❌ [GPT Service] Attempt ${i + 1} failed:`, error.message || error);
      
      // Don't retry rate limit errors - let UI handle countdown
      if (isRateLimitError(error)) {
        console.warn('⚠️  [GPT Service] Rate limit error detected - not retrying');
        throw error;
      }
      
      // If last retry, throw
      if (i === retries - 1) {
        console.error(`❌ [GPT Service] All ${retries} attempts failed`);
        throw error;
      }
      
      // Check for network/timeout errors
      const msg = error.message || '';
      if (msg.includes('fetch failed') || msg.includes('timeout') || msg.includes('network') || msg.includes('503')) {
        const waitTime = 1000 * (i + 1);
        console.warn(`⏳ [GPT Service] Network error detected. Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
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

// --- 1. Data Enrichment via Research Tools ---
export const enrichLeadData = async (companyName: string, keyPerson: string, city: string) => {
  if (!companyName || companyName.trim() === '') {
    throw new Error("Company name is required for data enrichment");
  }

  console.log('🟢 [GPT Service] enrichLeadData - Calling backend API with Research Tools');
  
  return gptApiCall<{ text: string; research: any }>('/enrich', {
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
  console.log('🟢 [GPT Service] draftSalesEmail - Calling backend API');
  
  return gptApiCall<{ subject: string; body: string }>('/draft-email', {
    leadName,
    leadCompany,
    leadTitle,
    eventContext,
  });
};

// --- 3. Chat Assistant ---
export const sendChatMessage = async (history: {role: string, content: string}[], message: string) => {
  console.log('🟢 [GPT Service] sendChatMessage - Calling backend API');
  
  const result = await gptApiCall<{ text: string }>('/chat', {
    history,
    message,
  });
  
  return result.text;
};

// --- 4. Extract Organizations (Smart Detection with Research) ---
export const extractOrganizations = async (data: string, summary?: any) => {
  console.log('🟢 [GPT Service] extractOrganizations - Calling backend API with Research Tools');
  console.log('📝 [GPT Service] Data length:', data.length, 'characters');
  
  const apiStartTime = Date.now();
  
  try {
    const result = await gptApiCall<{ organizations: Array<{ name: string; rowIndex?: number; sourceField?: string }> }>('/extract-organizations', {
      data,
      summary,
    });
    
    const apiTime = Date.now() - apiStartTime;
    console.log(`✅ [GPT Service] Extracted ${result.organizations?.length || 0} organizations in ${(apiTime / 1000).toFixed(2)}s`);
    
    return result.organizations || [];
  } catch (error: any) {
    const apiTime = Date.now() - apiStartTime;
    console.error(`❌ [GPT Service] Extract organizations failed after ${(apiTime / 1000).toFixed(2)}s`);
    console.error('❌ [GPT Service] Error:', error);
    
    if (error.retryDelay) {
      const retryError: any = new Error(error.message || 'Rate limit exceeded');
      retryError.retryDelay = error.retryDelay;
      retryError.isRateLimit = true;
      throw retryError;
    }
    
    throw error;
  }
};

// --- 5. Strategic Analysis (Intelligent Data with Research) ---
export const generateStrategicAnalysis = async (leadsData: string) => {
  console.log('🟢 [GPT Service] generateStrategicAnalysis - Calling backend API with Research Tools');
  console.log('📝 [GPT Service] Data length:', leadsData.length, 'characters');
  console.log('⏱️  [GPT Service] Start time:', new Date().toISOString());
  
  const apiStartTime = Date.now();
  
  try {
    const result = await gptApiCall<{ text: string }>('/strategic-analysis', {
      leadsData,
    });
    
    const apiTime = Date.now() - apiStartTime;
    console.log(`✅ [GPT Service] API call completed in ${(apiTime / 1000).toFixed(2)}s`);
    console.log('📄 [GPT Service] Response received, length:', result.text?.length || 0);
    
    return result.text;
  } catch (error: any) {
    const apiTime = Date.now() - apiStartTime;
    console.error(`❌ [GPT Service] API call failed after ${(apiTime / 1000).toFixed(2)}s`);
    console.error('❌ [GPT Service] Error:', error);
    
    if (error.retryDelay) {
      const retryError: any = new Error(error.message || 'Rate limit exceeded');
      retryError.retryDelay = error.retryDelay;
      retryError.isRateLimit = true;
      throw retryError;
    }
    
    throw error;
  }
};

// --- 6. Research Edition Leadership ---
export const researchEditionLeadership = async (
  eventName: string,
  edition: string,
  year: string,
  city: string,
  country: string
): Promise<{ organizingChairman: string; secretaryGeneral: string; confidence: string }> => {
  console.log('🟢 [GPT Service] researchEditionLeadership - Researching edition:', { eventName, year, city });
  
  try {
    const result = await gptApiCall<{ data: { organizingChairman: string; secretaryGeneral: string; confidence: string } }>('/research-edition', {
      eventName,
      edition,
      year,
      city,
      country,
    });
    
    return result.data || { organizingChairman: '', secretaryGeneral: '', confidence: 'low' };
  } catch (error: any) {
    console.error('❌ [GPT Service] Edition research failed:', error);
    return { organizingChairman: '', secretaryGeneral: '', confidence: 'low' };
  }
};
