# Frontend Design Spec — cyon Mail Manager

**Date:** 2026-04-20
**Status:** Approved
**Stack:** React 18 + TypeScript + Vite + Tailwind CSS 3 + shadcn/ui

## Overview

Complete SPA frontend for the cyon mail manager. Customers manage email accounts and forwards for their assigned domains. Admins manage users, domains, trigger syncs, and view audit logs. Served as static files by FastAPI on the same container.

## Tech Choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Routing | React Router v6 | Battle-tested, 7 pages don't need type-safe routing |
| Data fetching | TanStack Query v5 | Caching, loading/error states, mutation invalidation |
| HTTP client | Axios | JWT interceptor, typed responses |
| Components | shadcn/ui | High-quality Tailwind primitives, not a dependency — generates files |
| Icons | Lucide React | Pairs with shadcn/ui |
| Toasts | Sonner | shadcn/ui's recommended toast library |
| State | TanStack Query (server) + AuthContext (client) | Minimal context, no Redux/Zustand needed |

## Visual Direction

- **Clean & minimal** — zinc palette (shadcn/ui default), light background
- **Sidebar navigation** — fixed left sidebar, admin section separated by divider
- Customer role sees: Domains
- Admin role sees: Domains + Admin section (Dashboard, Users, Domains, Audit Log)
- User avatar + name at sidebar bottom with logout

## File Structure

```
src/
  main.tsx                    — React root, providers
  App.tsx                     — Route definitions, AuthProvider
  lib/
    api.ts                    — Axios instance, JWT interceptor, typed API functions
    auth.ts                   — AuthContext, useAuth hook, localStorage token
    utils.ts                  — Password generator, formatters
  types/
    index.ts                  — TS types matching backend schemas
  components/
    ui/                       — shadcn/ui generated components
    layout/
      AppLayout.tsx           — Sidebar + content wrapper
      Sidebar.tsx             — Nav items, role-aware
    ProtectedRoute.tsx        — Redirect to /login if unauthenticated
    AdminRoute.tsx            — Redirect to / if not admin
  pages/
    LoginPage.tsx
    DashboardPage.tsx
    DomainDetailPage.tsx
    admin/
      AdminDashboardPage.tsx
      UsersPage.tsx
      DomainsPage.tsx
      AuditLogPage.tsx
```

## Pages

### 1. Login (`/login`)

Centered card on light background. Username + password fields, "Sign in" button. Error displayed as inline alert below form. Redirects to `/` on success. If already authenticated, redirects to `/`.

### 2. Customer Dashboard (`/`)

Grid of domain cards. Each card shows domain name, email count, forward count. Click navigates to `/domains/:name`. If user has no domains, show empty state message.

### 3. Domain Detail (`/domains/:name`)

Back breadcrumb to dashboard. Domain name as heading. Two tabs:

**Email Accounts tab:**
- Quota counter: "3 of 10 used" (or "3 accounts (unlimited)" when max=0)
- Table: address, quota (MB), synced status (green/gray dot), delete button
- "+ New Email" button opens dialog:
  - Local part input (validates `^[a-zA-Z0-9._%+-]+$`)
  - Domain shown as read-only suffix (@example.ch)
  - Auto-generated 16-char password in read-only field + copy button
  - "Set custom password" toggle reveals editable password field
  - Optional quota field (MB)
  - Create button

**Forwards tab:**
- Quota counter (same pattern)
- Table: source address, destination, synced status, delete button
- "+ New Forward" button opens dialog:
  - Source local part input + domain suffix
  - Destination email input (validates email format)
  - Create button

Delete actions: confirmation dialog with entity name shown.

### 4. Admin Dashboard (`/admin`)

Stats cards row: total users, total domains, total email accounts. "Sync Now" button (spinner while running, toast on result). Recent audit log entries (last ~10, with relative timestamps).

### 5. User Manager (`/admin/users`)

Table: username, email, role (badge), active status (badge), created date. Actions column: edit, delete.

- **Create dialog:** username, password, email, role dropdown (admin/customer)
- **Edit dialog:** email, active toggle (no username/role change)
- **Delete:** confirmation dialog. Disabled with tooltip if user has assigned domains or is current user.

### 6. Domain Manager (`/admin/domains`)

Table: domain name, assigned user (or "Unassigned" in muted text), max emails, max forwards, created date. Actions column: edit, delete.

- **Create dialog:** domain name, user assignment dropdown (optional, customers only), max emails, max forwards
- **Edit dialog:** user reassignment dropdown, max emails, max forwards
- **Delete:** confirmation dialog

### 7. Audit Log (`/admin/audit`)

Paginated table of audit entries: timestamp (relative), user, action, target, detail. Loads via `GET /api/admin/audit?page=1&per_page=50`. "Load more" button for pagination (or infinite scroll). No create/edit — read-only view.

## Data Flow

### Authentication
1. Login POST → receive `{ token, user }` → store token in `localStorage`, user in AuthContext
2. Axios request interceptor attaches `Authorization: Bearer <token>` header
3. Axios response interceptor: on 401 → clear token, redirect to `/login`
4. On app mount: if token exists in localStorage, call `GET /api/auth/me` to validate and hydrate user
5. `useAuth()` returns `{ user, token, login(), logout(), isLoading }`

### API Layer
- `lib/api.ts` exports typed functions: `fetchDomains()`, `createEmail(domainName, data)`, etc.
- Each function calls the Axios instance and returns typed data
- Pages use TanStack Query: `useQuery({ queryKey: ['domains'], queryFn: fetchDomains })`
- Mutations use `useMutation` with `onSuccess` → `queryClient.invalidateQueries()`

### Query Keys
- `['domains']` — user's domain list
- `['domains', name, 'emails']` — emails for a domain
- `['domains', name, 'forwards']` — forwards for a domain
- `['admin', 'users']` — all users
- `['admin', 'domains']` — all domains (admin view)
- `['admin', 'audit']` — audit log entries

## Error Handling

- **Network errors / 5xx:** Toast notification with "Something went wrong. Please try again."
- **401 Unauthorized:** Auto-logout + redirect to login
- **403 Forbidden:** Toast "You don't have permission for this action"
- **409 Conflict:** Inline form error ("Email already exists", "Domain already exists")
- **422 Validation:** Inline form errors from server response
- **502 (cyon error):** Toast "cyon connection error — please try again later"
- **Form validation:** Client-side validation runs first (required fields, regex patterns). Prevents submission until valid.

## Loading States

- **Page data loading:** Skeleton loaders for tables and cards
- **Button actions:** Spinner inside button, button disabled during request
- **Sync:** Sync button shows spinner, disabled until complete

## Dependencies

```json
{
  "react": "^18.3",
  "react-dom": "^18.3",
  "react-router-dom": "^6.28",
  "@tanstack/react-query": "^5.60",
  "axios": "^1.7",
  "tailwindcss": "^3.4",
  "lucide-react": "^0.460",
  "sonner": "^1.7",
  "class-variance-authority": "^0.7",
  "clsx": "^2.1",
  "tailwind-merge": "^2.6"
}
```

shadcn/ui components installed via `npx shadcn@latest init` + `npx shadcn@latest add <component>`:
- Button, Input, Label, Card, Dialog, Table, Tabs, Badge, Separator, Skeleton, DropdownMenu, Select, Switch, Tooltip

## Vite Config

- Dev proxy: `/api` → `http://localhost:8000`
- Build output: `dist/` (served by FastAPI as static files)

## Not In Scope

- Password reset / forgot password (no email sending capability)
- Dark mode toggle (light only for v1)
- i18n (English only)
- Real-time updates / WebSocket
- Pagination for domain detail tables (reasonable scale per domain)
