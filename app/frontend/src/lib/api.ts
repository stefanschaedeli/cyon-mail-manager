import axios from "axios";
import type {
  AuditEntry,
  Domain,
  DomainCreate,
  DomainUpdate,
  EmailAccount,
  EmailCreate,
  EmailForward,
  ForwardCreate,
  LoginRequest,
  TokenResponse,
  User,
  UserCreate,
  UserUpdate,
} from "@/types";

const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const res = await api.post<TokenResponse>("/auth/login", data);
  return res.data;
}

export async function getMe(): Promise<User> {
  const res = await api.get<User>("/auth/me");
  return res.data;
}

// ── Customer domains ──────────────────────────────────────────────────────────

export async function fetchDomains(): Promise<Domain[]> {
  const res = await api.get<Domain[]>("/domains");
  return res.data;
}

// ── Emails ────────────────────────────────────────────────────────────────────

export async function fetchEmails(domainName: string): Promise<EmailAccount[]> {
  const res = await api.get<EmailAccount[]>(`/domains/${domainName}/emails`);
  return res.data;
}

export async function createEmail(
  domainName: string,
  data: EmailCreate
): Promise<EmailAccount> {
  const res = await api.post<EmailAccount>(
    `/domains/${domainName}/emails`,
    data
  );
  return res.data;
}

export async function deleteEmail(
  domainName: string,
  address: string
): Promise<void> {
  await api.delete(`/domains/${domainName}/emails/${address}`);
}

// ── Forwards ──────────────────────────────────────────────────────────────────

export async function fetchForwards(
  domainName: string
): Promise<EmailForward[]> {
  const res = await api.get<EmailForward[]>(
    `/domains/${domainName}/forwards`
  );
  return res.data;
}

export async function createForward(
  domainName: string,
  data: ForwardCreate
): Promise<EmailForward> {
  const res = await api.post<EmailForward>(
    `/domains/${domainName}/forwards`,
    data
  );
  return res.data;
}

export async function deleteForward(
  domainName: string,
  forwardId: number
): Promise<void> {
  await api.delete(`/domains/${domainName}/forwards/${forwardId}`);
}

// ── Admin: users ──────────────────────────────────────────────────────────────

export async function fetchUsers(): Promise<User[]> {
  const res = await api.get<User[]>("/admin/users");
  return res.data;
}

export async function createUser(data: UserCreate): Promise<User> {
  const res = await api.post<User>("/admin/users", data);
  return res.data;
}

export async function updateUser(id: number, data: UserUpdate): Promise<User> {
  const res = await api.put<User>(`/admin/users/${id}`, data);
  return res.data;
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/admin/users/${id}`);
}

// ── Admin: domains ────────────────────────────────────────────────────────────

export async function fetchAdminDomains(): Promise<Domain[]> {
  const res = await api.get<Domain[]>("/admin/domains");
  return res.data;
}

export async function createDomain(data: DomainCreate): Promise<Domain> {
  const res = await api.post<Domain>("/admin/domains", data);
  return res.data;
}

export async function updateDomain(
  id: number,
  data: DomainUpdate
): Promise<Domain> {
  const res = await api.put<Domain>(`/admin/domains/${id}`, data);
  return res.data;
}

export async function deleteDomain(id: number): Promise<void> {
  await api.delete(`/admin/domains/${id}`);
}

export async function fetchCyonDomains(): Promise<string[]> {
  const res = await api.get<string[]>("/admin/domains/cyon");
  return res.data;
}

export async function importDomains(domains: string[]): Promise<Domain[]> {
  const res = await api.post<Domain[]>("/admin/domains/import", { domains });
  return res.data;
}

// ── Admin: audit + sync ───────────────────────────────────────────────────────

export async function fetchAudit(page = 1): Promise<AuditEntry[]> {
  const res = await api.get<AuditEntry[]>("/admin/audit", {
    params: { page },
  });
  return res.data;
}

export async function triggerSync(): Promise<Record<string, unknown>> {
  const res = await api.post<Record<string, unknown>>("/admin/sync");
  return res.data;
}

export default api;
