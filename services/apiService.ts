import type { User, Lead, EmailTemplate, EmailLog, EmailLogAttachment, EmailReply, LeadWithEmailCount, ChatMessage } from '../types';

// Always use relative path /api/v1 - works in both dev and production
// In development, Vite proxy will forward /api/v1 requests to backend
const API_BASE_URL = '/api/v1';

// Log API base URL on module load (for debugging)
if (import.meta.env.DEV) {
  console.log(`🔗 API Base URL: ${API_BASE_URL}`);
}

// Helper function for API calls
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    // Check content-type header (don't read body yet)
    const contentType = response.headers.get('content-type') || '';

    // Read response body once as text first (can parse JSON from text)
    const responseText = await response.text();

    // Check if response is HTML (usually means proxy failed or route not found)
    if (contentType.includes('text/html') || responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
      console.error(`❌ API returned HTML instead of JSON:`, responseText.substring(0, 200));

      const isDev = import.meta.env.DEV;
      if (isDev) {
        throw new Error(`API server returned HTML. Make sure backend is running or check API configuration.`);
      } else {
        throw new Error(`API server returned HTML. Please ensure the backend API is deployed and accessible.`);
      }
    }

    // Parse JSON from text
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError: any) {
      // If JSON parse fails, log the response
      console.error(`❌ Failed to parse JSON response (${contentType}):`, responseText.substring(0, 200));
      const isDev = import.meta.env.DEV;
      if (isDev) {
        throw new Error(`Cannot parse API response as JSON. Backend may not be running or returned invalid response.`);
      } else {
        throw new Error(`Cannot parse API response as JSON. Please ensure the backend API is deployed and accessible.`);
      }
    }

    // Handle error responses
    if (!response.ok) {
      const errorMessage = responseData?.error || `HTTP error! status: ${response.status}`;
      throw new Error(errorMessage);
    }

    return responseData;
  } catch (error: any) {
    // Handle JSON parse errors (usually means HTML was returned)
    if (error.message && error.message.includes('JSON')) {
      const isDev = import.meta.env.DEV;
      if (isDev) {
        throw new Error(`Cannot parse API response. API may not be configured correctly. Check console for details.`);
      } else {
        throw new Error(`Cannot parse API response. Please ensure the backend API is deployed and accessible.`);
      }
    }

    // Handle network errors (CORS, connection refused, etc.)
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error(`❌ API call failed: ${API_BASE_URL}${endpoint}`, error);
      console.error(`   Error details:`, error.message);

      // More helpful error message
      const isDev = import.meta.env.DEV;
      if (isDev) {
        throw new Error(`Cannot connect to API server at ${API_BASE_URL}. Check if API is properly configured in Vite dev server.`);
      } else {
        throw new Error(`Cannot connect to API server at ${API_BASE_URL}. Please ensure the backend API is deployed and accessible.`);
      }
    }
    // Re-throw other errors
    throw error;
  }
}

// Users API
export const usersApi = {
  getAll: () => apiCall<User[]>('/users'),
  getByUsername: (username: string) => apiCall<User>(`/users/${username}`),
  create: (user: User) => apiCall<User>('/users', {
    method: 'POST',
    body: JSON.stringify(user),
  }),
  update: (username: string, user: Partial<User>) => apiCall<User>(`/users/${username}`, {
    method: 'PUT',
    body: JSON.stringify(user),
  }),
  delete: (username: string) => apiCall<void>(`/users/${username}`, {
    method: 'DELETE',
  }),
};

// Leads API
export const leadsApi = {
  getAll: (filters?: { status?: string; industry?: string; country?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.industry) params.append('industry', filters.industry);
    if (filters?.country) params.append('country', filters.country);
    if (filters?.search) params.append('search', filters.search);
    const query = params.toString();
    return apiCall<Lead[]>(`/leads${query ? `?${query}` : ''}`);
  },
  getById: (id: string) => apiCall<Lead>(`/leads/${id}`),
  getStats: () => apiCall<{ total: number; byStatus: Record<string, number>; byIndustry: Record<string, number>; byCountry: Record<string, number> }>('/leads/stats'),
  getWithEmailCount: (leadId?: string) => {
    const query = leadId ? `?leadId=${leadId}` : '';
    return apiCall<LeadWithEmailCount[]>(`/leads/with-email-count${query}`);
  },
  create: (lead: Lead) => apiCall<Lead>('/leads', {
    method: 'POST',
    body: JSON.stringify(lead),
  }),
  update: (id: string, lead: Partial<Lead>) => apiCall<Lead>(`/leads/${id}`, {
    method: 'PUT',
    body: JSON.stringify(lead),
  }),
  delete: (id: string) => apiCall<void>(`/leads/${id}`, {
    method: 'DELETE',
  }),
  sendEmails: (leadIds: string[], emails?: Array<{ leadId: string; subject: string; body: string }>) => {
    return apiCall<{ success: boolean; summary: any; updatedLeads: Lead[] }>('/leads/send-emails', {
      method: 'POST',
      body: JSON.stringify({ leadIds, emails }),
    });
  },
};

// Email Templates API
export const emailTemplatesApi = {
  getAll: () => apiCall<EmailTemplate[]>('/email-templates'),
  getById: (id: string) => apiCall<EmailTemplate>(`/email-templates/${id}`),
  create: (template: EmailTemplate) => apiCall<EmailTemplate>('/email-templates', {
    method: 'POST',
    body: JSON.stringify(template),
  }),
  update: (id: string, template: Partial<EmailTemplate>) => apiCall<EmailTemplate>(`/email-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(template),
  }),
  delete: (id: string) => apiCall<void>(`/email-templates/${id}`, {
    method: 'DELETE',
  }),
};

// Email Logs API
export const emailLogsApi = {
  getAll: (leadId?: string) => {
    const query = leadId ? `?leadId=${leadId}` : '';
    return apiCall<EmailLog[]>(`/email-logs${query}`);
  },
  getById: (id: string) => apiCall<EmailLog>(`/email-logs/${id}`),
  create: (emailLog: EmailLog) => apiCall<EmailLog>('/email-logs', {
    method: 'POST',
    body: JSON.stringify(emailLog),
  }),
  update: (id: string, emailLog: Partial<EmailLog>) => apiCall<EmailLog>(`/email-logs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(emailLog),
  }),
  delete: (id: string) => apiCall<void>(`/email-logs/${id}`, {
    method: 'DELETE',
  }),
  getAttachments: (emailLogId: string) => apiCall<EmailLogAttachment[]>(`/email-logs/${emailLogId}/attachments`),
  createAttachment: (emailLogId: string, attachment: Omit<EmailLogAttachment, 'id' | 'created_at'>) => apiCall<EmailLogAttachment>(`/email-logs/${emailLogId}/attachments`, {
    method: 'POST',
    body: JSON.stringify(attachment),
  }),
  deleteAttachment: (attachmentId: number) => apiCall<void>(`/email-logs/attachments/${attachmentId}`, {
    method: 'DELETE',
  }),
};

// Email Replies API
export const emailRepliesApi = {
  getAll: (leadId?: string, emailLogId?: string) => {
    const params = new URLSearchParams();
    if (leadId) params.append('leadId', leadId);
    if (emailLogId) params.append('emailLogId', emailLogId);
    const query = params.toString();
    return apiCall<EmailReply[]>(`/email-replies${query ? `?${query}` : ''}`);
  },
  getById: (id: string) => apiCall<EmailReply>(`/email-replies/${id}`),
  create: (leadId: string) => apiCall<EmailReply>('/email-replies', {
    method: 'POST',
    body: JSON.stringify({ leadId }),
  }),
  checkInbox: (options?: { since?: string; maxEmails?: number; subjectFilter?: string }) => apiCall<{ success: boolean; processedCount: number; message: string }>('/email-replies/check-inbox', {
    method: 'POST',
    body: JSON.stringify(options || {}),
  }),
  countBySubject: (subjectFilter: string, options?: { since?: string; includeRead?: boolean }) => {
    const params = new URLSearchParams();
    params.append('subject', subjectFilter);
    if (options?.since) params.append('since', options.since);
    if (options?.includeRead) params.append('includeRead', 'true');
    return apiCall<{ success: boolean; count: number; subjectFilter: string; message: string }>(`/email-replies/count-by-subject?${params.toString()}`);
  },
  delete: (id: string) => apiCall<void>(`/email-replies/${id}`, {
    method: 'DELETE',
  }),
};

// Chat Messages API
export interface ChatMessageDB {
  id: string;
  username: string;
  role: 'user' | 'model' | 'assistant'; // 'model' for backward compatibility, 'assistant' for GPT
  text: string;
  timestamp: Date | string;
  created_at?: Date;
}

export const chatMessagesApi = {
  getByUsername: (username: string) => apiCall<ChatMessageDB[]>(`/chat-messages/${username}`),
  create: (message: ChatMessageDB) => apiCall<ChatMessageDB>('/chat-messages', {
    method: 'POST',
    body: JSON.stringify(message),
  }),
  deleteByUsername: (username: string) => apiCall<void>(`/chat-messages/${username}`, {
    method: 'DELETE',
  }),
  deleteById: (id: string) => apiCall<void>(`/chat-messages/message/${id}`, {
    method: 'DELETE',
  }),
};

// Lead Scoring API
export const leadScoringApi = {
  calculateScore: (leadId: string) => apiCall<{
    success: boolean;
    leadId: string;
    score: number;
    factors: {
      emailEngagement: number;
      eventHistory: number;
      contactQuality: number;
      companySize: number;
    };
    reasoning: string;
  }>(`/lead-scoring/${leadId}/calculate`, { method: 'POST' }),

  batchCalculate: (leadIds: string[]) => apiCall<{
    success: boolean;
    total: number;
    scores: Record<string, number>;
  }>('/lead-scoring/batch', {
    method: 'POST',
    body: JSON.stringify({ leadIds }),
  }),

  getTopScored: (limit: number = 10) => apiCall<{
    success: boolean;
    leads: Lead[];
  }>(`/lead-scoring/top?limit=${limit}`),

  getDistribution: () => apiCall<{
    success: boolean;
    distribution: {
      high: number;
      medium: number;
      low: number;
      unscored: number;
    };
  }>('/lead-scoring/distribution'),
};

// Email Reports API
export interface EmailReportsConfig {
  id: string;
  recipient_email: string;
  recipient_name?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  day_of_week?: number;
  day_of_month?: number;
  time_hour: number;
  time_minute: number;
  timezone: string;
  enabled: boolean;
  include_stats: boolean;
  include_new_leads: boolean;
  include_email_activity: boolean;
  include_top_leads: boolean;
  top_leads_count: number;
  last_sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailReportsLog {
  id: string;
  config_id: string;
  recipient_email: string;
  report_type: 'daily' | 'weekly' | 'monthly';
  period_start: string;
  period_end: string;
  sent_at: string;
  status: 'sent' | 'failed';
  error_message?: string;
  stats_summary?: any;
}

export const emailReportsApi = {
  getAll: (enabledOnly?: boolean) => apiCall<EmailReportsConfig[]>(
    `/email-reports/config${enabledOnly ? '?enabled=true' : ''}`
  ),
  getById: (id: string) => apiCall<EmailReportsConfig>(`/email-reports/config/${id}`),
  create: (config: Omit<EmailReportsConfig, 'id' | 'created_at' | 'updated_at' | 'last_sent_at'>) =>
    apiCall<EmailReportsConfig>('/email-reports/config', {
      method: 'POST',
      body: JSON.stringify(config),
    }),
  update: (id: string, config: Partial<EmailReportsConfig>) =>
    apiCall<EmailReportsConfig>(`/email-reports/config/${id}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
  delete: (id: string) =>
    apiCall<{ message: string }>(`/email-reports/config/${id}`, {
      method: 'DELETE',
    }),
  send: (id: string) =>
    apiCall<{ message: string; success: boolean }>(`/email-reports/send/${id}`, {
      method: 'POST',
    }),
  trigger: () =>
    apiCall<{ message: string }>('/email-reports/trigger', {
      method: 'POST',
    }),
  getLogs: (configId?: string, limit?: number) =>
    apiCall<EmailReportsLog[]>(
      `/email-reports/logs${configId ? `?config_id=${configId}` : ''}${limit ? `${configId ? '&' : '?'}limit=${limit}` : ''}`
    ),
};

