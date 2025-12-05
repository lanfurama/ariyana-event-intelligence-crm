import { GoogleGenAI, Type } from "@google/genai";

// Helper to ensure API Key is present
const getAiClient = () => {
  // Vite uses import.meta.env for environment variables
  // Variable must be prefixed with VITE_ to be exposed to frontend
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Gemini API Key not found. Please set VITE_GEMINI_API_KEY in your .env file');
    throw new Error("API Key not found in environment variables. Please set VITE_GEMINI_API_KEY in your .env file");
  }
  return new GoogleGenAI({ apiKey });
};

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
      return await fn();
    } catch (error: any) {
      // Don't retry rate limit errors - let UI handle countdown
      if (isRateLimitError(error)) {
        throw error;
      }
      
      // If last retry, throw
      if (i === retries - 1) throw error;
      
      // Check for network/RPC errors (code 6, fetch failed, etc.)
      const msg = error.message || '';
      if (msg.includes('error code: 6') || msg.includes('fetch failed') || msg.includes('Rpc failed') || msg.includes('503')) {
         console.warn(`Attempt ${i + 1} failed. Retrying...`, error);
         await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
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
  const ai = getAiClient();
  // Using free tier model
  const modelId = "gemini-2.5-flash-lite"; 

  // Validate inputs
  if (!companyName || companyName.trim() === '') {
    throw new Error("Company name is required for data enrichment");
  }

  // Build prompt with clear context
  const keyPersonInfo = keyPerson && keyPerson.trim() ? `Key contact person: ${keyPerson}` : "Key contact person: Not specified";
  const cityInfo = city && city.trim() ? `Located in: ${city}` : "Location: Not specified";

  const prompt = `You are a business research assistant. I need you to provide information about the following organization:

Organization Name: ${companyName}
${keyPersonInfo}
${cityInfo}

Please provide a comprehensive summary based on your knowledge about this organization. Include:

1. **Company Overview**: Brief description of what this organization does
2. **Contact Information**: 
   - Website URL (if known)
   - General contact email format or domain
3. **Event History**: If this is an event organizer or association, mention any notable past events or conferences they have organized (include years and locations if known)
4. **Industry Context**: What industry or sector this organization operates in
5. **Recent Activity**: Any notable recent news or activities (if known)

If you don't have specific information about this organization, please state that clearly and provide general information about organizations of this type or name.

Format your response in a clear, structured way that would be useful for a sales team trying to reach out to this organization.`;

  return retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      // Note: Google Search tool is not available on free tier models
      // config: {
      //   tools: [{ googleSearch: {} }],
      // },
    });

    const text = response.text || "No results found.";
    // Grounding metadata may not be available without Google Search tool
    const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks || null;
    
    return { text, grounding };
  });
};

// --- 2. Email Drafting ---
export const draftSalesEmail = async (
  leadName: string, 
  leadCompany: string, 
  leadTitle: string,
  eventContext: string
) => {
  const ai = getAiClient();
  const modelId = "gemini-2.5-flash-lite"; // Using free tier model

  const prompt = `Write a personalized, professional sales email to ${leadName}, ${leadTitle} at ${leadCompany}.
  
  Context: I am representing 'Ariyana Convention Centre' in Danang, Vietnam.
  We want to host their next event: ${eventContext}.
  
  Highlight:
  - Oceanfront location
  - Large capacity (APEC venue)
  - Proximity to heritage sites
  
  Tone: Professional, warm, inviting.
  Format: JSON with 'subject' and 'body' fields.`;

  return retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            body: { type: Type.STRING },
          },
        },
      },
    });

    try {
      const cleaned = cleanJson(response.text || "{}");
      return JSON.parse(cleaned);
    } catch (e) {
      console.error("JSON Parse Error", e);
      return { subject: "Error generating subject", body: response.text };
    }
  });
};

// --- 3. Chat Assistant ---
export const sendChatMessage = async (history: {role: string, parts: {text: string}[]}[], message: string) => {
  const ai = getAiClient();
  
  // Note: Streaming or simple message. Using simple for robustness here.
  const chat = ai.chats.create({
    model: 'gemini-2.5-flash-lite',
    history: history,
    config: {
      systemInstruction: "You are a helpful sales assistant for Ariyana Convention Centre. You help the sales team analyze leads, suggest strategies, and answer questions about the MICE industry in Vietnam."
    }
  });

  return retryOperation(async () => {
    const response = await chat.sendMessage({ message });
    return response.text;
  });
};

// --- 4. Video Analysis ---
export const analyzeVideoContent = async (base64Data: string, mimeType: string) => {
  const ai = getAiClient();
  const modelId = "gemini-2.5-flash-lite";

  const prompt = "Analyze this video/image. Identify the key selling points of the venue shown, the audience type, and the overall vibe. Suggest how Ariyana Convention Centre can differentiate itself from this competitor.";

  return retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          { text: prompt }
        ]
      }
    });

    return response.text;
  });
};

// --- 5. Veo Video Generation ---
// Note: This requires the window.aistudio key flow

export const generatePromoVideo = async (prompt: string, aspectRatio: '16:9' | '9:16' = '16:9') => {
  // Check/Request Key first
  const win = window as any;
  if (win.aistudio) {
    const hasKey = await win.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await win.aistudio.openSelectKey();
    }
  }

  // Re-init client to ensure it picks up the selected key (if handled by the environment injection)
  const ai = getAiClient();

  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: '1080p',
      aspectRatio: aspectRatio
    }
  });

  return operation; // Return the operation to be polled
};

export const pollVideoOperation = async (operation: any) => {
  const ai = getAiClient();
  return retryOperation(async () => {
     const updatedOp = await ai.operations.getVideosOperation({ operation });
     return updatedOp;
  });
};

// --- 6. Strategic Analysis (Intelligent Data) ---
export const generateStrategicAnalysis = async (leadsData: string) => {
  const ai = getAiClient();
  const modelId = "gemini-2.5-flash-lite";

  const prompt = `
Context: You are the Director of International Sales for Ariyana Convention Centre Danang, Vietnam (the venue that successfully hosted APEC 2017). Your goal is to analyze a raw list of potential MICE leads and identify the best targets to host their next conference in Danang in 2026 or 2027.

Input Data (CSV/Text format provided below):
${leadsData}

Task 1: The Filtering Algorithm (Logic Step)
Analyze the rows and identify "High Potential Leads" based on this scoring criteria:
- History Score: If Vietnam Events Count >= 1, they are familiar with the destination. (High priority).
- Region Score: If Company Name contains "ASEAN", "Asia", "Pacific", or "Eastern", they likely rotate within our region.
- Contact Score: Must have a valid Key Person Email.

Task 2: The Enrichment (Research Step)
For the top 3-5 leads identified in Task 1:
- Analyze their Industry or Name.
- Internal Thought: Check if they have already announced their 2025/2026 venue.

Task 3: Output Generation
Please generate a report in the following format:

PART A: STRATEGIC ANALYSIS
Create a Markdown table with the top 5 leads:
| Organization | Score Reason | Next Step Strategy |
| :--- | :--- | :--- |
| [Name] | [e.g., Been to VN twice...] | [e.g., Propose for 2027...] |

PART B: ACTIONABLE EMAILS
Draft 3 personalized emails for the Top 3 leads.

PART C: STRUCTURED DATA (JSON)
Crucial: Output the "High Potential Leads" identified in Task 1 as a valid JSON array so I can import them into my database.
Use this structure for each object:
{
  "companyName": "String",
  "industry": "String (Infer if missing)",
  "country": "String (Infer if missing)",
  "city": "String (Infer if missing)",
  "keyPersonName": "String",
  "keyPersonTitle": "String",
  "keyPersonEmail": "String",
  "vietnamEvents": Number,
  "notes": "String (The Score Reason)",
  "pastEventsHistory": "String (Infer from input or context)",
  "status": "New"
}
Ensure the JSON is wrapped in \`\`\`json\`\`\` code blocks.
`;

  return retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    return response.text;
  });
};