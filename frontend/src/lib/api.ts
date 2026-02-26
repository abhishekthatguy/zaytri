/**
 * Zaytri — API Client
 * Handles all communication with the FastAPI backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Token Management ──────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("zaytri_token");
}

export function setToken(token: string): void {
  localStorage.setItem("zaytri_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("zaytri_token");
}

// ─── Fetch Wrapper ─────────────────────────────────────────────────────────

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    // Only trigger session-expired flow if user was actually logged in (had a token)
    if (token) {
      clearToken();
      if (typeof window !== "undefined") {
        const p = window.location.pathname;
        const isPublic = p === "/" || ["/login", "/signup", "/forgot-password", "/reset-password", "/verify", "/auth/callback", "/about", "/privacy", "/terms", "/resources"].some(r => p.startsWith(r));
        if (!isPublic) {
          // Dispatch event for SessionProvider to show popup
          window.dispatchEvent(new CustomEvent("zaytri-session-expired"));
        }
      }
    }
    throw new Error("Session expired. Please sign in again.");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

// ─── Auth Endpoints ────────────────────────────────────────────────────────

export async function login(identifier: string, password: string) {
  const data = await apiFetch<{ access_token: string; refresh_token?: string; token_type: string; user: Record<string, unknown>; requires_2fa: boolean }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    }
  );
  if (!data.requires_2fa) {
    setToken(data.access_token);
  }
  return data;
}

export async function register(
  username: string,
  email: string,
  password: string,
  phone?: string
) {
  const data = await apiFetch<{ access_token: string; token_type: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password, phone }),
  });
  setToken(data.access_token);
  return data;
}

// ─── Workflow Endpoints ────────────────────────────────────────────────────

export async function runWorkflow(
  topic: string,
  platform: string,
  tone: string
) {
  return apiFetch("/workflow/run", {
    method: "POST",
    body: JSON.stringify({ topic, platform, tone }),
  });
}

export async function runWorkflowAsync(
  topic: string,
  platform: string,
  tone: string
) {
  return apiFetch("/workflow/run-async", {
    method: "POST",
    body: JSON.stringify({ topic, platform, tone }),
  });
}

export async function getWorkflowStatus(taskId: string) {
  return apiFetch(`/workflow/status/${taskId}`);
}

// ─── Content Endpoints ─────────────────────────────────────────────────────

export async function listContent(params?: {
  status?: string;
  platform?: string;
  limit?: number;
  offset?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.platform) searchParams.set("platform", params.platform);
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.offset) searchParams.set("offset", params.offset.toString());

  const query = searchParams.toString();
  return apiFetch(`/content${query ? `?${query}` : ""}`);
}

export async function getContent(id: string) {
  return apiFetch(`/content/${id}`);
}

export async function approveContent(id: string) {
  return apiFetch(`/content/${id}/approve`, { method: "PATCH" });
}

export async function rejectContent(id: string) {
  return apiFetch(`/content/${id}/reject`, { method: "PATCH" });
}

export async function deleteContent(id: string) {
  return apiFetch(`/content/${id}`, { method: "DELETE" });
}

export async function editContent(id: string, data: {
  caption?: string;
  hook?: string;
  cta?: string;
  post_text?: string;
  improved_text?: string;
  topic?: string;
  tone?: string;
}) {
  return apiFetch(`/content/${id}/edit`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function publishNow(id: string) {
  return apiFetch(`/content/${id}/publish-now`, { method: "POST" });
}

export interface DashboardStats {
  total: number;
  by_status: Record<string, number>;
  avg_review_score: number;
  recent_published_7d: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return apiFetch("/content/stats");
}

// ─── Analytics Endpoints ───────────────────────────────────────────────────

export async function getAnalyticsReport(days: number = 7) {
  return apiFetch(`/analytics/report?days=${days}`);
}

export async function getPlatformAnalytics(platform: string, days: number = 7) {
  return apiFetch(`/analytics/platform/${platform}?days=${days}`);
}

// ─── Platform Endpoints ────────────────────────────────────────────────────

export async function listPlatforms() {
  return apiFetch("/platforms");
}

export async function testPlatform(name: string) {
  return apiFetch(`/platforms/${name}/test`, { method: "POST" });
}

// ─── Health ────────────────────────────────────────────────────────────────

export async function healthCheck() {
  return apiFetch("/health");
}

// ─── WhatsApp Approval ────────────────────────────────────────────────────

export interface WhatsAppStatus {
  configured: boolean;
  phone_number_id: string | null;
  approval_phone: string | null;
}

export interface WhatsAppApproval {
  id: string;
  content_id: string;
  status: "pending" | "approved" | "rejected" | "expired";
  phone_number: string;
  sent_at: string | null;
  responded_at: string | null;
  expires_at: string | null;
}

export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  return apiFetch("/whatsapp/status");
}

export async function sendForWhatsAppApproval(
  contentId: string
): Promise<{ status: string; approval_id: string; token: string }> {
  return apiFetch(`/whatsapp/send-approval/${contentId}`, { method: "POST" });
}

export async function listWhatsAppApprovals(
  status?: string
): Promise<WhatsAppApproval[]> {
  const query = status ? `?status=${status}` : "";
  return apiFetch(`/whatsapp/approvals${query}`);
}

// ─── Settings: Cron ────────────────────────────────────────────────────────

export interface CronSettings {
  scheduler_hour: number;
  scheduler_minute: number;
  engagement_delay_hours: number;
  analytics_day_of_week: number;
  analytics_hour: number;
  analytics_minute: number;
  timezone: string;
}

export async function getCronSettings(): Promise<CronSettings> {
  return apiFetch("/settings/cron");
}

export async function updateCronSettings(data: CronSettings): Promise<CronSettings> {
  return apiFetch("/settings/cron", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ─── Social Connections (OAuth-based) ──────────────────────────────────────

export interface SocialPlatformInfo {
  platform: string;
  display_name: string;
  icon: string;
  configured: boolean;
  connected_accounts: number;
  note: string;
}

export interface SocialConnectionInfo {
  id: string;
  platform: string;
  platform_account_id: string;
  platform_username: string | null;
  platform_avatar_url: string | null;
  account_type: string | null;
  is_active: boolean;
  connected_at: string | null;
  last_used_at: string | null;
  last_error: string | null;
  brand_id: string | null;
}

export async function listSocialPlatforms(): Promise<SocialPlatformInfo[]> {
  return apiFetch("/social/platforms");
}

export async function getSocialConnectURL(
  platform: string,
  redirectUri: string
): Promise<{ url: string; platform: string }> {
  return apiFetch(`/social/connect/${platform}?redirect_uri=${encodeURIComponent(redirectUri)}`);
}

export async function handleSocialCallback(
  platform: string,
  code: string,
  redirectUri: string,
  state?: string
): Promise<SocialConnectionInfo> {
  return apiFetch(`/social/callback/${platform}`, {
    method: "POST",
    body: JSON.stringify({ code, redirect_uri: redirectUri, state }),
  });
}

export async function listSocialConnections(
  platform?: string
): Promise<SocialConnectionInfo[]> {
  const query = platform ? `?platform=${platform}` : "";
  return apiFetch(`/social/connections${query}`);
}

export async function disconnectSocialAccount(connectionId: string): Promise<void> {
  return apiFetch(`/social/connections/${connectionId}`, { method: "DELETE" });
}

export async function updateSocialConnection(connectionId: string, data: { brand_id: string | null }): Promise<SocialConnectionInfo> {
  return apiFetch(`/social/connections/${connectionId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function permanentlyDeleteSocialConnection(connectionId: string) {
  return apiFetch(`/social/connections/${connectionId}/permanent`, { method: "DELETE" });
}



// ─── Settings: Google Drive ────────────────────────────────────────────────

export interface GoogleDriveConfig {
  folder_url: string | null;
  folder_id: string | null;
  is_connected: boolean;
  last_synced_at: string | null;
}

export async function getGoogleDriveConfig(): Promise<GoogleDriveConfig> {
  return apiFetch("/settings/google-drive");
}

export async function updateGoogleDriveConfig(data: {
  folder_url: string;
  access_token?: string;
  refresh_token?: string;
}): Promise<GoogleDriveConfig> {
  return apiFetch("/settings/google-drive", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function disconnectGoogleDrive() {
  return apiFetch("/settings/google-drive", { method: "DELETE" });
}

// ─── Settings: Brands ──────────────────────────────────────────────────────

export interface BrandSettings {
  id: string;
  brand_name: string;
  target_audience: string | null;
  brand_tone: string | null;
  brand_guidelines: string | null;
  core_values: string | null;
}

export async function listBrands(): Promise<BrandSettings[]> {
  return apiFetch("/settings/brands");
}

export async function createBrand(data: Partial<BrandSettings>): Promise<BrandSettings> {
  return apiFetch("/settings/brands", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateBrand(id: string, data: Partial<BrandSettings>): Promise<BrandSettings> {
  return apiFetch(`/settings/brands/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteBrand(id: string) {
  return apiFetch(`/settings/brands/${id}`, { method: "DELETE" });
}

// ─── Settings: Knowledge Sources ──────────────────────────────────────────

export interface KnowledgeSource {
  id: string;
  brand_id: string | null;
  source_type: string;
  name: string;
  url: string | null;
  content_summary: string | null;
  is_active: boolean;
  last_indexed_at: string | null;
  vector_count: number;
  created_at: string;
}

export async function listKnowledgeSources(brand_id?: string): Promise<KnowledgeSource[]> {
  const query = brand_id ? `?brand_id=${brand_id}` : "";
  return apiFetch(`/settings/knowledge${query}`);
}

export async function createKnowledgeSource(data: Partial<KnowledgeSource>): Promise<KnowledgeSource> {
  return apiFetch("/settings/knowledge", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateKnowledgeSource(id: string, data: Partial<KnowledgeSource>): Promise<KnowledgeSource> {
  return apiFetch(`/settings/knowledge/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteKnowledgeSource(id: string) {
  return apiFetch(`/settings/knowledge/${id}`, { method: "DELETE" });
}

// ─── Settings: LLM Providers ──────────────────────────────────────────────

export interface LLMProvider {
  provider: string;
  models: string[];
  is_configured: boolean;
  is_enabled: boolean;
  test_status: string | null;
  last_tested_at: string | null;
  masked_key: string | null;
}

export interface AgentModelConfig {
  agent_id: string;
  provider: string;
  model: string;
  is_custom: boolean;
}

export async function listLLMProviders(): Promise<LLMProvider[]> {
  return apiFetch("/settings/llm/providers");
}

export async function saveLLMProviderKey(provider: string, api_key: string) {
  return apiFetch("/settings/llm/providers/key", {
    method: "POST",
    body: JSON.stringify({ provider, api_key }),
  });
}

export async function deleteLLMProviderKey(provider: string) {
  return apiFetch(`/settings/llm/providers/${provider}/key`, { method: "DELETE" });
}

export async function testLLMProvider(provider: string) {
  return apiFetch(`/settings/llm/providers/${provider}/test`, { method: "POST" });
}

export async function listAgentModelConfigs(): Promise<AgentModelConfig[]> {
  return apiFetch("/settings/llm/agents");
}

export async function assignAgentModel(agent_id: string, provider: string, model: string) {
  return apiFetch("/settings/llm/agents/assign", {
    method: "POST",
    body: JSON.stringify({ agent_id, provider, model }),
  });
}

export async function resetAgentModel(agent_id: string) {
  return apiFetch("/settings/llm/agents/reset", {
    method: "POST",
    body: JSON.stringify({ agent_id }),
  });
}

// ─── Chat (Master Agent) ──────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  intent?: string;
  created_at?: string;
  model_used?: string;
  token_cost?: number;
  image_data?: string[];  // base64-encoded images
}

export interface ChatResponse {
  conversation_id: string;
  response: string;
  intent: string;
  model_used?: string;
  token_cost?: number;
  action_success: boolean;
  action_data?: Record<string, unknown>;
}

export interface ConversationPreview {
  conversation_id: string;
  preview: string;
  last_at: string | null;
}

export async function sendChatMessage(
  message: string,
  conversation_id?: string,
  images?: string[],
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    exec_mode?: string;
    context_controls?: {
      brand_memory: boolean;
      calendar_context: boolean;
      past_posts: boolean;
      engagement_data: boolean;
    };
  }
): Promise<ChatResponse> {
  return apiFetch("/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      conversation_id,
      model: options?.model,
      temperature: options?.temperature,
      max_tokens: options?.max_tokens,
      exec_mode: options?.exec_mode,
      context_controls: options?.context_controls,
      ...(images && images.length > 0 ? { images } : {}),
    }),
  });
}

export async function getChatHistory(
  conversation_id: string
): Promise<ChatMessage[]> {
  return apiFetch(`/chat/history/${conversation_id}`);
}

export async function listConversations(): Promise<ConversationPreview[]> {
  return apiFetch("/chat/conversations");
}

export async function deleteConversation(conversation_id: string): Promise<void> {
  return apiFetch(`/chat/conversations/${conversation_id}`, {
    method: "DELETE",
  });
}

export async function renameConversation(conversation_id: string, name: string): Promise<void> {
  return apiFetch(`/chat/conversations/${conversation_id}`, {
    method: "PATCH",
    body: JSON.stringify({ preview: name }),
  });
}

// ─── Calendar (Content Calendar Pipeline) ──────────────────────────────────

export interface CalendarUpload {
  id: string;
  name: string;
  source_type: string;
  total_rows: number;
  parsed_rows: number;
  failed_rows: number;
  is_processed: boolean;
  created_at: string;
}

export interface CalendarEntry {
  id: string;
  upload_id: string;
  row_number: number | null;
  date: string | null;
  brand: string | null;
  content_type: string | null;
  topic: string;
  tone: string | null;
  platforms: string[];
  default_hashtags: string[];
  generated_hashtags: string[];
  approval_required: boolean;
  status: string;
  pipeline_stage: string;
  content_ids: string[];
  pipeline_errors: string[] | null;
  created_at: string;
}

export interface CalendarStats {
  total_uploads: number;
  total_entries: number;
  by_status: Record<string, number>;
  by_brand: Record<string, number>;
  by_platform: Record<string, number>;
}

export async function uploadCalendarCSV(file: File, name?: string) {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);
  if (name) formData.append("name", name);

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/calendar/upload/csv`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Upload failed: ${response.status}`);
  }
  return response.json();
}

export async function uploadCalendarGoogleSheet(url: string, name?: string) {
  return apiFetch("/calendar/upload/google-sheet", {
    method: "POST",
    body: JSON.stringify({ url, name: name || "Google Sheet Import" }),
  });
}

export async function uploadCalendarJSON(file: File, name?: string) {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);
  if (name) formData.append("name", name);

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/calendar/upload/json`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Upload failed: ${response.status}`);
  }
  return response.json();
}

export async function listCalendarUploads(limit = 20, offset = 0) {
  return apiFetch<{ total: number; items: CalendarUpload[] }>(
    `/calendar/uploads?limit=${limit}&offset=${offset}`
  );
}

export async function deleteCalendarUpload(uploadId: string) {
  return apiFetch(`/calendar/uploads/${uploadId}`, { method: "DELETE" });
}

export async function listCalendarEntries(params?: {
  upload_id?: string;
  status?: string;
  brand?: string;
  platform?: string;
  limit?: number;
  offset?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.upload_id) searchParams.set("upload_id", params.upload_id);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.brand) searchParams.set("brand", params.brand);
  if (params?.platform) searchParams.set("platform", params.platform);
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.offset) searchParams.set("offset", params.offset.toString());

  const query = searchParams.toString();
  return apiFetch<{ total: number; items: CalendarEntry[] }>(
    `/calendar/entries${query ? `?${query}` : ""}`
  );
}

export async function getCalendarEntry(entryId: string) {
  return apiFetch(`/calendar/entries/${entryId}`);
}

export async function processCalendarUpload(uploadId: string) {
  return apiFetch(`/calendar/process/upload/${uploadId}`, { method: "POST" });
}

export async function processCalendarUploadAsync(uploadId: string) {
  return apiFetch(`/calendar/process/upload/${uploadId}/async`, { method: "POST" });
}

export async function processCalendarEntry(entryId: string) {
  return apiFetch(`/calendar/process/entry/${entryId}`, { method: "POST" });
}

export async function getCalendarStats(): Promise<CalendarStats> {
  return apiFetch("/calendar/stats");
}

