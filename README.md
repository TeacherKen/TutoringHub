# TutoringHub

Mr Ken's tutoring app: lessons from Google Calendar, quick lesson notes, parent feedback (via ChatGPT for now), worksheets, package hours in baht, and a schedule-only view for family.

Phase 1 of 3. Phase 2 adds parent sign-in. Phase 3 adds student practice and games.

## Setup (one time, about 20 minutes)

### 1. Supabase (the database)
TutoringHub keeps all its tables in its own schema called `tutoring`, so it can live inside an existing project (Mr Ken uses the **ourhome** project) without touching that app's data.

1. Open the **ourhome** project → **SQL Editor** → **New query**.
2. Paste everything in `supabase/migrations/0001_init.sql` → **Run**.
3. New query again → paste `supabase/migrations/0002_storage.sql` → **Run**.
4. **Project Settings → Data API → Exposed schemas** → add `tutoring` → Save.
5. **Project Settings → API Keys** — copy the Project URL, the Publishable (anon) key and the Secret (service_role) key. Keep the secret one private.

### 2. Google sign-in
If ourhome already uses Google sign-in, skip to step 4.
1. **console.cloud.google.com** → **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
2. **Authorised redirect URI**: `https://<your-project>.supabase.co/auth/v1/callback`
3. In Supabase: **Authentication → Sign In / Providers → Google** → turn on, paste the Client ID and secret → Save.
4. **Authentication → URL Configuration → Redirect URLs** → add `https://<your-vercel-address>/auth/callback` (do this after step 3 below). **Don't change the Site URL** — that belongs to Our Home.

TutoringHub only trusts Google sign-ins, and only the emails you add in Settings. Other sign-in methods your other app uses are ignored, so leave them as they are.

### 3. Vercel (the website)
1. **vercel.com → Add New → Project** → import `TeacherKen/TutoringHub`.
2. Add these **Environment Variables**:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable / anon key |
| `SUPABASE_SECRET_KEY` | Supabase secret / service_role key |
| `TUTOR_EMAIL` | The Google email you sign in with |
| `TUTOR_NAME` | `Mr Ken` |

3. Press **Deploy**. Copy your site address, e.g. `https://tutoringhub.vercel.app`.
4. Back in Supabase: add `https://<your-vercel-address>/auth/callback` to **Redirect URLs** (section 2, step 4).

### 4. First use
1. Open your Vercel address → **Sign in with Google**.
2. **Settings → Google Calendar** → paste your *Secret address in iCal format* (steps are shown in the app).
3. **Students → Add** each student. Their first name is used to find their lessons in your calendar.
4. **Settings → Who can sign in** → add Best's Google email as *Family — schedule only*.
5. On your iPhone: open the site in Safari → Share → **Add to Home Screen**.

## For developers
- Next.js 16 (App Router), Supabase (Postgres, Auth, Storage), Tailwind v4.
- `npm run dev` — local server (needs a `.env.local` with the variables above).
- `npm test` — tests, including the database security rules (runs the real migration in an in-memory Postgres).
- All times are Asia/Bangkok.
