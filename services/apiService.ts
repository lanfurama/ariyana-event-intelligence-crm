import type {
  User,
  Lead,
  EmailTemplate,
  EmailLog,
  EmailLogAttachment,
  EmailReply,
  LeadWithEmailCount,
  ChatMessage,
  Venue,
  Booking,
  BookingStatus,
  BookingSource,
  Quote,
  QuoteItemKind,
  QuoteStatus,
} from '../types';

// Always use relative path /api/v1 - works in both dev and production
// In development, Vite proxy will forward /api/v1 requests to backend
const API_BASE_URL = '/api/v1';

// Log API base URL on module load (for debugging)
if (import.meta.env.DEV) {
  console.log(`🔗 API Base URL: ${API_BASE_URL}`);
}

const TOKEN_STORAGE_KEY = 'ariyana_token';

/** Bearer header for the logged-in session (empty when logged out / on public pages). */
export function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/** Session expired or token invalid — drop credentials and send the user to login. */
function forceLogout() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem('ariyana_user');
  } catch {
    // ignore storage failures
  }
  window.location.reload();
}

// Helper function for API calls
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...options?.headers,
      },
    });

    // Check content-type header (don't read body yet)
    const contentType = response.headers.get('content-type') || '';

    // Read response body once as text first (can parse JSON from text)
    const responseText = await response.text();

    // Empty-body responses (CRUD deletes return 204 No Content) have nothing to parse
    if (responseText.trim() === '') {
      if (response.ok) {
        return undefined as T;
      }
      if (response.status === 401 && !endpoint.startsWith('/auth/')) {
        forceLogout();
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Check if response is HTML (usually means proxy failed or route not found)
    if (
      contentType.includes('text/html') ||
      responseText.trim().startsWith('<!DOCTYPE') ||
      responseText.trim().startsWith('<html')
    ) {
      console.error(`❌ API returned HTML instead of JSON:`, responseText.substring(0, 200));

      const isDev = import.meta.env.DEV;
      if (isDev) {
        throw new Error(
          `API server returned HTML. Make sure backend is running or check API configuration.`,
        );
      } else {
        throw new Error(
          `API server returned HTML. Please ensure the backend API is deployed and accessible.`,
        );
      }
    }

    // Parse JSON from text
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError: any) {
      // If JSON parse fails, log the response
      console.error(
        `❌ Failed to parse JSON response (${contentType}):`,
        responseText.substring(0, 200),
      );
      const isDev = import.meta.env.DEV;
      if (isDev) {
        throw new Error(
          `Cannot parse API response as JSON. Backend may not be running or returned invalid response.`,
        );
      } else {
        throw new Error(
          `Cannot parse API response as JSON. Please ensure the backend API is deployed and accessible.`,
        );
      }
    }

    // Handle error responses
    if (!response.ok) {
      // Expired/invalid session (but never during login/change-password attempts)
      if (response.status === 401 && !endpoint.startsWith('/auth/')) {
        forceLogout();
      }
      const errorMessage = responseData?.error || `HTTP error! status: ${response.status}`;
      throw new Error(errorMessage);
    }

    return responseData;
  } catch (error: any) {
    // Handle JSON parse errors (usually means HTML was returned)
    if (error.message && error.message.includes('JSON')) {
      const isDev = import.meta.env.DEV;
      if (isDev) {
        throw new Error(
          `Cannot parse API response. API may not be configured correctly. Check console for details.`,
        );
      } else {
        throw new Error(
          `Cannot parse API response. Please ensure the backend API is deployed and accessible.`,
        );
      }
    }

    // Handle network errors (CORS, connection refused, etc.)
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error(`❌ API call failed: ${API_BASE_URL}${endpoint}`, error);
      console.error(`   Error details:`, error.message);

      // More helpful error message
      const isDev = import.meta.env.DEV;
      if (isDev) {
        throw new Error(
          `Cannot connect to API server at ${API_BASE_URL}. Check if API is properly configured in Vite dev server.`,
        );
      } else {
        throw new Error(
          `Cannot connect to API server at ${API_BASE_URL}. Please ensure the backend API is deployed and accessible.`,
        );
      }
    }
    // Re-throw other errors
    throw error;
  }
}

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    apiCall<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => apiCall<User>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiCall<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),
};

// Users API
export const usersApi = {
  getAll: () => apiCall<User[]>('/users'),
  getByUsername: (username: string) => apiCall<User>(`/users/${username}`),
  create: (user: User) =>
    apiCall<User>('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    }),
  update: (username: string, user: Partial<User>) =>
    apiCall<User>(`/users/${username}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    }),
  delete: (username: string) =>
    apiCall<void>(`/users/${username}`, {
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
  getStats: () =>
    apiCall<{
      total: number;
      byStatus: Record<string, number>;
      byIndustry: Record<string, number>;
      byCountry: Record<string, number>;
    }>('/leads/stats'),
  getWithEmailCount: (leadId?: string) => {
    const query = leadId ? `?leadId=${leadId}` : '';
    return apiCall<LeadWithEmailCount[]>(`/leads/with-email-count${query}`);
  },
  create: (lead: Lead) =>
    apiCall<Lead>('/leads', {
      method: 'POST',
      body: JSON.stringify(lead),
    }),
  update: (id: string, lead: Partial<Lead>) =>
    apiCall<Lead>(`/leads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(lead),
    }),
  delete: (id: string) =>
    apiCall<void>(`/leads/${id}`, {
      method: 'DELETE',
    }),
  sendEmails: (
    leadIds: string[],
    emails?: Array<{ leadId: string; subject: string; body: string }>,
  ) => {
    return apiCall<{ success: boolean; summary: any; updatedLeads: Lead[] }>('/leads/send-emails', {
      method: 'POST',
      body: JSON.stringify({ leadIds, emails }),
    });
  },
  sendEmail: (
    leadId: string,
    subject: string,
    body: string,
    cc?: string,
    attachments?: Array<{ name: string; file_data: string; type: string }>,
  ) => {
    return apiCall<{ success: boolean; summary: any; updatedLead?: Lead }>('/leads/send-email', {
      method: 'POST',
      body: JSON.stringify({ leadId, subject, body, cc, attachments }),
    });
  },
};

// Email Templates API
export const emailTemplatesApi = {
  getAll: async () => {
    const templates = await apiCall<any[]>('/email-templates');
    // Map lead_type to leadType for frontend, keep language & attachments
    return templates.map((t) => ({
      ...t,
      leadType: t.lead_type,
      language: t.language || '',
      attachments: t.attachments || [],
    }));
  },
  getById: async (id: string) => {
    const template = await apiCall<any>(`/email-templates/${id}`);
    return {
      ...template,
      leadType: template.lead_type,
      language: template.language || '',
    };
  },
  create: async (template: EmailTemplate) => {
    // Map leadType to lead_type for backend, keep language
    const backendTemplate = {
      ...template,
      lead_type: template.leadType,
    };
    delete backendTemplate.leadType;
    const result = await apiCall<any>('/email-templates', {
      method: 'POST',
      body: JSON.stringify(backendTemplate),
    });
    // Map lead_type to leadType for frontend, keep attachments
    return {
      ...result,
      leadType: result.lead_type,
      language: result.language || '',
      attachments: result.attachments || [],
    };
  },
  update: async (id: string, template: Partial<EmailTemplate>) => {
    // Map leadType to lead_type for backend, keep language
    const backendTemplate: any = { ...template };
    if (template.leadType !== undefined) {
      backendTemplate.lead_type = template.leadType;
      delete backendTemplate.leadType;
    }
    const result = await apiCall<any>(`/email-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(backendTemplate),
    });
    // Map lead_type to leadType for frontend, keep attachments
    return {
      ...result,
      leadType: result.lead_type,
      language: result.language || '',
      attachments: result.attachments || [],
    };
  },
  delete: (id: string) =>
    apiCall<void>(`/email-templates/${id}`, {
      method: 'DELETE',
    }),
  sendTest: (
    to: string,
    subject: string,
    body: string,
    attachments?: Array<{ name: string; file_data: string; type?: string }>,
    cc?: string[],
  ) =>
    apiCall<{ success: boolean }>('/email-templates/send-test', {
      method: 'POST',
      body: JSON.stringify({ to, subject, body, attachments: attachments || [], cc: cc || [] }),
    }),
};

// Email Logs API
export const emailLogsApi = {
  getAll: (leadId?: string) => {
    const query = leadId ? `?leadId=${leadId}` : '';
    return apiCall<EmailLog[]>(`/email-logs${query}`);
  },
  getById: (id: string) => apiCall<EmailLog>(`/email-logs/${id}`),
  create: (emailLog: EmailLog) =>
    apiCall<EmailLog>('/email-logs', {
      method: 'POST',
      body: JSON.stringify(emailLog),
    }),
  update: (id: string, emailLog: Partial<EmailLog>) =>
    apiCall<EmailLog>(`/email-logs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(emailLog),
    }),
  delete: (id: string) =>
    apiCall<void>(`/email-logs/${id}`, {
      method: 'DELETE',
    }),
  getAttachments: (emailLogId: string) =>
    apiCall<EmailLogAttachment[]>(`/email-logs/${emailLogId}/attachments`),
  createAttachment: (
    emailLogId: string,
    attachment: Omit<EmailLogAttachment, 'id' | 'created_at'>,
  ) =>
    apiCall<EmailLogAttachment>(`/email-logs/${emailLogId}/attachments`, {
      method: 'POST',
      body: JSON.stringify(attachment),
    }),
  deleteAttachment: (attachmentId: number) =>
    apiCall<void>(`/email-logs/attachments/${attachmentId}`, {
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
  create: (leadId: string) =>
    apiCall<EmailReply>('/email-replies', {
      method: 'POST',
      body: JSON.stringify({ leadId }),
    }),
  checkInbox: (options?: { since?: string; maxEmails?: number; subjectFilter?: string }) =>
    apiCall<{ success: boolean; processedCount: number; message: string }>(
      '/email-replies/check-inbox',
      {
        method: 'POST',
        body: JSON.stringify(options || {}),
      },
    ),
  countBySubject: (subjectFilter: string, options?: { since?: string; includeRead?: boolean }) => {
    const params = new URLSearchParams();
    params.append('subject', subjectFilter);
    if (options?.since) params.append('since', options.since);
    if (options?.includeRead) params.append('includeRead', 'true');
    return apiCall<{ success: boolean; count: number; subjectFilter: string; message: string }>(
      `/email-replies/count-by-subject?${params.toString()}`,
    );
  },
  delete: (id: string) =>
    apiCall<void>(`/email-replies/${id}`, {
      method: 'DELETE',
    }),
};

// Chat Messages API
// chatMessagesApi and leadScoringApi were removed 2026-07-16 with the
// email-marketing refocus: the chat view is gone and no view ever consumed
// lead scoring. Backend routes remain; re-add typed wrappers if needed.

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
  getAll: (enabledOnly?: boolean) =>
    apiCall<EmailReportsConfig[]>(`/email-reports/config${enabledOnly ? '?enabled=true' : ''}`),
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
      `/email-reports/logs${configId ? `?config_id=${configId}` : ''}${limit ? `${configId ? '&' : '?'}limit=${limit}` : ''}`,
    ),
};

// --- Venue booking APIs (smart convention centre track) ---

/** booking_spaces row joined with its booking code/title, as served by /bookings/availability. */
export interface AvailabilityBlock {
  id: number;
  booking_id: string;
  venue_id: string;
  start_at: string;
  end_at: string;
  setup_minutes: number;
  teardown_minutes: number;
  block_start_at: string;
  block_end_at: string;
  booking_status: BookingStatus;
  code: string;
  title: string;
}

export interface SpaceConflictsResult {
  hard: AvailabilityBlock[];
  soft: AvailabilityBlock[];
}

/** Per-space overlap report returned as non-blocking `warnings` by POST /bookings. */
export interface SpaceConflictWarning {
  venue_id: string;
  block_start_at: string;
  block_end_at: string;
  hard: AvailabilityBlock[];
  soft: AvailabilityBlock[];
}

export interface BookingSpacePayload {
  venue_id: string;
  start_at: string;
  end_at: string;
  setup_minutes: number;
  teardown_minutes: number;
}

export interface BookingPayload {
  title: string;
  lead_id?: string | null;
  event_type?: string;
  status?: BookingStatus;
  expected_guests?: number | null;
  layout?: string;
  notes?: string;
  source?: BookingSource;
  created_by?: string;
  spaces: BookingSpacePayload[];
}

export interface BookingFilters {
  status?: BookingStatus;
  venue_id?: string;
  lead_id?: string;
  from?: string;
  to?: string;
  search?: string;
}

export const venuesApi = {
  getAll: (includeInactive = false) =>
    apiCall<Venue[]>(`/venues${includeInactive ? '?include_inactive=true' : ''}`),
  getById: (id: string) => apiCall<Venue>(`/venues/${id}`),
  create: (venue: Partial<Venue> & { name: string }) =>
    apiCall<Venue>('/venues', {
      method: 'POST',
      body: JSON.stringify(venue),
    }),
  update: (id: string, updates: Partial<Venue>) =>
    apiCall<Venue>(`/venues/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  delete: (id: string) =>
    apiCall<void>(`/venues/${id}`, {
      method: 'DELETE',
    }),
};

export const bookingsApi = {
  getAll: (filters?: BookingFilters) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.venue_id) params.append('venue_id', filters.venue_id);
    if (filters?.lead_id) params.append('lead_id', filters.lead_id);
    if (filters?.from) params.append('from', filters.from);
    if (filters?.to) params.append('to', filters.to);
    if (filters?.search) params.append('search', filters.search);
    const query = params.toString();
    return apiCall<Booking[]>(`/bookings${query ? `?${query}` : ''}`);
  },
  getById: (id: string) => apiCall<Booking>(`/bookings/${id}`),
  create: (payload: BookingPayload) =>
    apiCall<{ booking: Booking; warnings: SpaceConflictWarning[] }>('/bookings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id: string, payload: Partial<BookingPayload>) =>
    apiCall<Booking>(`/bookings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  delete: (id: string) =>
    apiCall<void>(`/bookings/${id}`, {
      method: 'DELETE',
    }),
  /** Authed intake (AI-parsed or manual) — same pipeline as the public portal form. */
  intake: (payload: {
    company_name: string;
    contact_name: string;
    email: string;
    phone?: string;
    country?: string;
    event_type?: string;
    message?: string;
    expected_guests?: number;
    venue_id?: string;
    preferred_date?: string;
  }) =>
    apiCall<{ booking: Booking; lead: Lead }>('/bookings/intake', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getAvailability: (from: string, to: string, venueId?: string) => {
    const params = new URLSearchParams({ from, to });
    if (venueId) params.append('venue_id', venueId);
    return apiCall<AvailabilityBlock[]>(`/bookings/availability?${params.toString()}`);
  },
  checkConflicts: (space: BookingSpacePayload & { exclude_booking_id?: string }) => {
    const params = new URLSearchParams({
      venue_id: space.venue_id,
      start_at: space.start_at,
      end_at: space.end_at,
      setup_minutes: String(space.setup_minutes),
      teardown_minutes: String(space.teardown_minutes),
    });
    if (space.exclude_booking_id) params.append('exclude_booking_id', space.exclude_booking_id);
    return apiCall<SpaceConflictsResult>(`/bookings/check-conflicts?${params.toString()}`);
  },
};

export interface QuoteItemPayload {
  kind: QuoteItemKind;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface QuotePayload {
  discount_pct?: number;
  vat_pct?: number;
  status?: QuoteStatus;
  valid_until?: string | null;
  notes?: string | null;
  sent_at?: string | null;
  items?: QuoteItemPayload[];
}

export const quotesApi = {
  getAll: (bookingId?: string) =>
    apiCall<Quote[]>(`/quotes${bookingId ? `?booking_id=${encodeURIComponent(bookingId)}` : ''}`),
  getById: (id: string) => apiCall<Quote>(`/quotes/${id}`),
  create: (bookingId: string, payload: QuotePayload & { items: QuoteItemPayload[] }) =>
    apiCall<Quote>('/quotes', {
      method: 'POST',
      body: JSON.stringify({ booking_id: bookingId, ...payload }),
    }),
  update: (id: string, payload: QuotePayload) =>
    apiCall<Quote>(`/quotes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  delete: (id: string) =>
    apiCall<void>(`/quotes/${id}`, {
      method: 'DELETE',
    }),
  /** Direct download URL for the proposal document. */
  docxUrl: (id: string) => `${API_BASE_URL}/quotes/${id}/docx`,
  /** Authenticated download of the proposal DOCX (window.open cannot carry the Bearer header). */
  downloadDocx: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/quotes/${id}/docx`, { headers: authHeaders() });
    if (!response.ok) {
      throw new Error(`Failed to download proposal (HTTP ${response.status})`);
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const fileName = match ? match[1] : `Proposal-${id}.docx`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },
  /** Fetch the proposal DOCX as a data-URL, ready for the send-email attachment pipeline. */
  fetchDocxAsDataUrl: async (id: string): Promise<{ fileName: string; dataUrl: string }> => {
    const response = await fetch(`${API_BASE_URL}/quotes/${id}/docx`, { headers: authHeaders() });
    if (!response.ok) {
      throw new Error(`Failed to fetch proposal document (HTTP ${response.status})`);
    }
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read proposal document'));
      reader.readAsDataURL(blob);
    });
    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    return { fileName: match ? match[1] : `Proposal-${id}.docx`, dataUrl };
  },
};
