# Mingle

Connect. Share. Discover. React + TypeScript + Vite frontend with Supabase Auth and PostgreSQL.

## Local setup

1. Run `npm install` (generates `package-lock.json`; commit it for CI).
2. Copy `.env.example` to `.env` and fill in your Supabase **project URL** and **publishable/anon key**. Never use the service role key in the frontend.
3. Apply SQL migration in `supabase/migrations/` to your Supabase project.
4. In Supabase Auth, configure Site URL `https://cozynxis.github.io/Mingle/` and allow redirect `https://cozynxis.github.io/Mingle/**` and local dev `http://localhost:5173/**`. Enable email provider and Google provider as needed.
5. Run `npm run dev` and open the local URL.
6. Run `npm run build` and `npm test`.

## GitHub Pages

Set repository Actions secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (public client keys, not service-role credentials). In Settings → Pages, choose GitHub Actions as the source. Workflow `.github/workflows/deploy.yml` deploys `/Mingle/` on push to `main`.

## Phase 1 scope

Responsive dark/light/system UI, account modal, Supabase email sign-in/sign-up/reset, Google OAuth initiation, session persistence, profile migration, basic authenticated post creation/feed. Remaining features are labeled as upcoming; no fake counts or seeded users.

**Important:** MFA enrollment, full account settings, private follower approvals, chat, notifications, premium, admin, full testing, and production security hardening are not yet implemented. Configure your own Supabase project before expecting login and posting to work.
