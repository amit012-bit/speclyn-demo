/**
 * Typed API client for the Speclyn Node.js backend (port 4000).
 * Base URL comes from NEXT_PUBLIC_API_URL; every authenticated request
 * attaches the JWT as a Bearer token.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ---------------------------------------------------------------------------
// Response / request types — must match the backend contract exactly.
// ---------------------------------------------------------------------------

export interface SpecificityGap {
  id: string;
  condition: string;
  missing: string;
  possible_codes: string[];
  why: string;
}

export interface HccOpportunity {
  id: string;
  condition: string;
  status: string;
  detail: string;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
}

export interface RevenueItem {
  condition: string;
  low: number;
  high: number;
  basis: string;
}

export interface RevenueImpact {
  total_range: { low: number; high: number };
  items: RevenueItem[];
  assumptions: string;
}

export interface AnalysisResult {
  specificity_gaps: SpecificityGap[];
  hcc_opportunities: HccOpportunity[];
  clarification_questions: ClarificationQuestion[];
  revenue_impact: RevenueImpact;
  provider?: string;
}

export type AnalysisMode = "complete" | "realtime";

export interface AnalyzeRequest {
  note_text: string;
  mode: AnalysisMode;
  specialty?: string;
  previous_gaps?: string[];
}

export interface LoginResponse {
  token: string;
}

export interface SttTokenResponse {
  /** Short-lived AssemblyAI streaming token (browser connects directly). */
  token: string;
  /** Specialty key terms to bias the streaming model (keyterms_prompt). */
  keyterms: string[];
  /** AssemblyAI domain hint for the streaming session (e.g. "medical"). */
  domain: string;
}

// ---------------------------------------------------------------------------
// Token storage.
//
// PILOT NOTE: the JWT is kept in localStorage, which is acceptable for this
// password-gated pilot with synthetic data only. Upgrade path for production:
//   1. Have the backend set the JWT in an httpOnly, Secure, SameSite=Strict
//      cookie on POST /auth/login instead of returning it in the body.
//   2. Send credentials via `credentials: "include"` on fetch and the
//      socket.io `withCredentials` option instead of a Bearer header.
//   3. Enforce auth in Next.js middleware.ts (reading the cookie server-side)
//      instead of the client-side redirect in app/dashboard/page.tsx.
// ---------------------------------------------------------------------------

const TOKEN_KEY = "speclyn_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      "Cannot reach the Speclyn backend. Is it running on port 4000?"
    );
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      message = data.error ?? data.message ?? message;
    } catch {
      // Non-JSON error body — keep the default message.
    }
    throw new ApiError(res.status, message);
  }

  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/** POST /auth/login — exchange the shared password for a 24h JWT. */
export function login(password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: { password },
    auth: false,
  });
}

/** POST /analysis/analyze — run CDI analysis on a note or transcript. */
export function analyzeNote(req: AnalyzeRequest): Promise<AnalysisResult> {
  return request<AnalysisResult>("/analysis/analyze", {
    method: "POST",
    body: req,
  });
}

/** GET /analysis/stt-token — temporary AssemblyAI streaming credentials
 *  plus the specialty keyterms/domain for the realtime STT session.
 *  Throws ApiError on any non-200 response. */
export function getSttToken(): Promise<SttTokenResponse> {
  return request<SttTokenResponse>("/analysis/stt-token");
}
