/**
 * Zaytri — Auth API Client
 * All authentication-related API calls.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthUser {
    id: string;
    username: string;
    email: string;
    phone?: string;
    display_name?: string;
    avatar_url?: string;
    is_active: boolean;
    is_admin: boolean;
    is_email_verified: boolean;
    is_phone_verified: boolean;
    is_2fa_enabled: boolean;
    created_at: string;
}

export interface AuthResponse {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    user: AuthUser;
    requires_2fa: boolean;
}

export interface MessageResponse {
    message: string;
    success: boolean;
}

export interface Setup2FAResponse {
    secret: string;
    uri: string;
    qr_code_base64?: string;
}

export interface OAuthProviders {
    google: boolean;
    facebook: boolean;
    github: boolean;
    twitter: boolean;
}

// ─── Token Management ──────────────────────────────────────────────────────

export function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("zaytri_token");
}

export function setToken(token: string): void {
    localStorage.setItem("zaytri_token", token);
}

export function setRefreshToken(token: string): void {
    localStorage.setItem("zaytri_refresh_token", token);
}

export function clearTokens(): void {
    localStorage.removeItem("zaytri_token");
    localStorage.removeItem("zaytri_refresh_token");
}

export function setUser(user: AuthUser): void {
    localStorage.setItem("zaytri_user", JSON.stringify(user));
}

export function getUser(): AuthUser | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("zaytri_user");
    return raw ? JSON.parse(raw) : null;
}

// ─── Fetch Wrapper ─────────────────────────────────────────────────────────

async function authFetch<T>(
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

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `Error: ${response.status}`);
    }

    return response.json();
}

// ─── Auth Endpoints ────────────────────────────────────────────────────────

export async function authLogin(
    identifier: string,
    password: string
): Promise<AuthResponse> {
    const data = await authFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
    });
    if (!data.requires_2fa) {
        setToken(data.access_token);
        if (data.refresh_token) setRefreshToken(data.refresh_token);
        setUser(data.user);
    }
    return data;
}

export async function authRegister(
    username: string,
    email: string,
    password: string,
    phone?: string
): Promise<AuthResponse> {
    const data = await authFetch<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password, phone }),
    });
    setToken(data.access_token);
    if (data.refresh_token) setRefreshToken(data.refresh_token);
    setUser(data.user);
    return data;
}

export async function authLoginWithOTP(
    identifier: string,
    otp_code: string
): Promise<AuthResponse> {
    const data = await authFetch<AuthResponse>("/auth/login/otp", {
        method: "POST",
        body: JSON.stringify({ identifier, otp_code }),
    });
    setToken(data.access_token);
    if (data.refresh_token) setRefreshToken(data.refresh_token);
    setUser(data.user);
    return data;
}

// ─── OTP ────────────────────────────────────────────────────────────────────

export async function sendOTP(
    identifier: string,
    purpose: string
): Promise<MessageResponse> {
    return authFetch<MessageResponse>("/auth/otp/send", {
        method: "POST",
        body: JSON.stringify({ identifier, purpose }),
    });
}

export async function verifyOTP(
    identifier: string,
    otp_code: string,
    purpose: string
): Promise<MessageResponse> {
    return authFetch<MessageResponse>("/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ identifier, otp_code, purpose }),
    });
}

// ─── Password ──────────────────────────────────────────────────────────────

export async function forgotPassword(
    email: string
): Promise<MessageResponse> {
    return authFetch<MessageResponse>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
    });
}

export async function resetPasswordWithToken(
    token: string,
    new_password: string
): Promise<MessageResponse> {
    return authFetch<MessageResponse>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, new_password }),
    });
}

export async function resetPasswordWithOTP(
    email: string,
    otp_code: string,
    new_password: string
): Promise<MessageResponse> {
    return authFetch<MessageResponse>("/auth/reset-password/otp", {
        method: "POST",
        body: JSON.stringify({ email, otp_code, new_password }),
    });
}

export async function changePassword(
    current_password: string,
    new_password: string
): Promise<MessageResponse> {
    return authFetch<MessageResponse>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password, new_password }),
    });
}

// ─── 2FA ────────────────────────────────────────────────────────────────────

export async function setup2FA(): Promise<Setup2FAResponse> {
    return authFetch<Setup2FAResponse>("/auth/2fa/setup", {
        method: "POST",
    });
}

export async function enable2FA(code: string): Promise<MessageResponse> {
    return authFetch<MessageResponse>("/auth/2fa/enable", {
        method: "POST",
        body: JSON.stringify({ code }),
    });
}

export async function disable2FA(code: string): Promise<MessageResponse> {
    return authFetch<MessageResponse>("/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ code }),
    });
}

export async function verify2FALogin(
    code: string,
    tempToken: string
): Promise<AuthResponse> {
    const data = await authFetch<AuthResponse>("/auth/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ code }),
        headers: { Authorization: `Bearer ${tempToken}` },
    });
    setToken(data.access_token);
    if (data.refresh_token) setRefreshToken(data.refresh_token);
    setUser(data.user);
    return data;
}

// ─── OAuth ──────────────────────────────────────────────────────────────────

export async function getOAuthProviders(): Promise<OAuthProviders> {
    return authFetch<OAuthProviders>("/auth/oauth/providers");
}

export async function getOAuthURL(
    provider: string,
    redirectUri: string
): Promise<{ url: string; provider: string }> {
    return authFetch(`/auth/oauth/${provider}/url?redirect_uri=${encodeURIComponent(redirectUri)}`);
}

export async function oauthCallback(
    provider: string,
    code: string,
    redirect_uri?: string
): Promise<AuthResponse> {
    const data = await authFetch<AuthResponse>("/auth/oauth/callback", {
        method: "POST",
        body: JSON.stringify({ provider, code, redirect_uri }),
    });
    setToken(data.access_token);
    if (data.refresh_token) setRefreshToken(data.refresh_token);
    setUser(data.user);
    return data;
}

// ─── User ───────────────────────────────────────────────────────────────────

export async function updateProfile(data: {
    display_name?: string;
    avatar_url?: string;
}): Promise<AuthUser> {
    const params = new URLSearchParams();
    if (data.display_name !== undefined) params.set("display_name", data.display_name);
    if (data.avatar_url !== undefined) params.set("avatar_url", data.avatar_url);
    const user = await authFetch<AuthUser>(`/auth/me?${params.toString()}`, {
        method: "PUT",
    });
    setUser(user);
    return user;
}

export async function getMe(): Promise<AuthUser> {
    return authFetch<AuthUser>("/auth/me");
}

export function logout(): void {
    clearTokens();
    localStorage.removeItem("zaytri_user");
    if (typeof window !== "undefined") {
        window.location.href = "/login";
    }
}
