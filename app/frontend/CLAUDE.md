# Frontend CLAUDE.md

React 18 + TypeScript + Vite + Tailwind CSS 3. SPA served as static files by FastAPI.

## Commands

```bash
npm install
npm run dev      # dev server, proxies /api → localhost:8000
npm run build    # outputs dist/ (consumed by Docker multi-stage)
```

## Conventions

- TypeScript strict mode, no `any`
- Functional components + hooks only
- Tailwind utility classes, no custom CSS unless unavoidable
- Typed API calls via `lib/api.ts` — never raw fetch in components
- Metric units in all user-facing text (MB not MiB, Swiss context)

## Pages

| Page | Route | Access |
|------|-------|--------|
| Login | `/login` | public |
| Customer Dashboard | `/` | customer + admin |
| Domain Detail | `/domains/:name` | customer + admin |
| Admin Dashboard | `/admin` | admin |
| User Manager | `/admin/users` | admin |
| Domain Manager | `/admin/domains` | admin |

## Domain Detail page

Two tabs: **Email Accounts** (address + quota, create/delete) and **Forwards** (source → destination, create/delete).

## Auth flow

`hooks/useAuth.ts` manages JWT token (localStorage), exposes `user`, `login()`, `logout()`.
`App.tsx` wraps routes with auth context and redirects unauthenticated users to `/login`.
Admin-only routes redirect non-admins.
