// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  token: string;
  user: User;
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  email: string;
  role: "admin" | "customer";
  is_active: boolean;
  created_at: string;
}

export interface UserCreate {
  username: string;
  password: string;
  email: string;
  role: "admin" | "customer";
}

export interface UserUpdate {
  email?: string;
  is_active?: boolean;
}

// ── Domains ───────────────────────────────────────────────────────────────────

export interface Domain {
  id: number;
  name: string;
  user_id: number | null;
  max_emails: number;
  max_forwards: number;
  created_at: string;
}

export interface DomainCreate {
  name: string;
  user_id?: number | null;
  max_emails?: number;
  max_forwards?: number;
}

export interface DomainUpdate {
  user_id?: number | null;
  max_emails?: number;
  max_forwards?: number;
}

// ── Email accounts ────────────────────────────────────────────────────────────

export interface EmailAccount {
  id: number;
  address: string;
  domain_id: number;
  quota_mb: number;
  synced: boolean;
  created_at: string;
}

export interface EmailCreate {
  local_part: string;
  password: string;
  quota_mb?: number;
}

// ── Forwards ──────────────────────────────────────────────────────────────────

export interface EmailForward {
  id: number;
  source: string;
  destination: string;
  domain_id: number;
  synced: boolean;
  created_at: string;
}

export interface ForwardCreate {
  source_local: string;
  destination: string;
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: number;
  user_id: number | null;
  action: string;
  target: string;
  detail: string | null;
  created_at: string;
}
