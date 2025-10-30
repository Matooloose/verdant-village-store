<!--
Guidance for automated coding agents working on the Verdant Village Store repo.
Keep this short, concrete and focused on discoverable patterns, runtime scripts, and integration points.
--> 

# Copilot / AI agent instructions — verdant-village-store

Quick orientation
- Frontend: Vite + React + TypeScript + Tailwind + shadcn/ui. Entry: `src/main.tsx` -> `App.tsx`.
- Backend helpers: small local node helpers live at the repo root (e.g. `payfast-webhook-server.ts`, `payfast-signature-server.js`).
- Database & auth: Supabase integration used via `src/integrations/supabase/client`.

Important scripts
- `npm run dev` — start Vite frontend.
- `npm run webhook-server` — run the local PayFast webhook helper (uses `node -r esbuild-register payfast-webhook-server.ts`).
- `npm run signature-server` — local PayFast signature helper (see `payfast-signature-server.js`).
- `npm run payfast:dev` — concurrently runs signature + webhook + frontend for payment flow testing.

Key runtime endpoints (useful when reproducing console errors)
- Webhook helper (default): `http://localhost:3002`
  - `POST /subscriptions/create-intent` — create a pending subscription (used by `src/pages/Subscriptions.tsx`).
  - `GET  /health` — simple health check used during local debugging.
  - `POST /payfast/webhook` — PayFast ITN handler that activates pending subscriptions and updates orders.

Environment variables to know
- `VITE_PAYFAST_SERVER_URL` — override the webhook helper URL used by the frontend (defaults to `http://localhost:3002`).
- `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — used by webhook/signature servers and server-side scripts.
- `PAYFAST_PASSPHRASE` — used to validate PayFast signatures in `payfast-webhook-server.ts`.

Patterns & project conventions
- Sticky headers: `index.css` includes a `.page-topbar` utility; pages use this class for consistent sticky topbars.
- Bottom nav: `src/components/BottomNavBar.tsx` is rendered globally from `App.tsx` and the app adds bottom padding to avoid overlap. Avoid adding page-level duplicate navs.
- Supabase usage: prefer `src/integrations/supabase/client` import; many server helpers call Supabase directly (watch for service-role key usage).
- Subscriptions/payment flow: frontend creates a pending intent via the webhook helper (`/subscriptions/create-intent`) then calls an external PayFast URL service for redirection. The webhook server matches PayFast's `custom_str1`/`custom_str2` to reconcile payments.
- Local persistence: small bits of state live in localStorage (e.g., `subscription_next` is used to redirect after subscription completes). Recently-viewed products and pending ids are also persisted in localStorage in several components.

Common pitfalls discovered in the codebase
- Dev server errors often come from the PayFast helper not running: if the browser shows `POST http://localhost:3002/... 503`, start `npm run webhook-server` or `npm run payfast:dev` and check `/health`.
- Some server scripts are written in TypeScript and expected to be run via `esbuild-register` (see `package.json`). If `node -r esbuild-register` fails on your machine, bundle with `esbuild` or run via `ts-node` as a fallback.
- The repo contains a few pre-existing TypeScript/lint warnings (use of `any`, missing hook deps). Prefer minimal, idiomatic fixes — keep changes localized.

Where to look for behaviour examples (code pointers)
- Subscriptions flow: `src/pages/Subscriptions.tsx` (builds intent -> calls payfast-url service -> redirects).
- PayFast webhook + create-intent: `payfast-webhook-server.ts` (server-side processing & user_subscriptions writes).
- Sticky header pattern: `src/index.css` and pages using `page-topbar` (e.g. `src/pages/ProductDetail.tsx`).
- Global nav: `src/components/BottomNavBar.tsx` and `src/App.tsx` for placement + safe-area handling.
- Supabase client: `src/integrations/supabase/client` (single source for DB access).

Work acceptance hints for agents
- When changing UI layout that affects navigation/topbars, run `npm run dev` and visually verify: sticky header behavior and BottomNavBar overlap on Checkout and Product pages.
- When touching payments/subscriptions, include instructions to run `npm run payfast:dev` and verify `/health` and a successful `POST /subscriptions/create-intent` returns 200 with a pending id.

If anything above is unclear or you'd like more examples (e.g., where localStorage keys are defined), tell me which area to expand and I will iterate.
