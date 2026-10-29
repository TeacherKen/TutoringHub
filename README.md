# TutoringHub

Mr Ken's tutoring app: lessons from Google Calendar, quick lesson notes, parent feedback (via ChatGPT for now), worksheets, package hours in baht, and a schedule-only view for family.

Phase 1 of 3. Phase 2 adds parent sign-in. Phase 3 adds student practice and games.

## Setup (one time, about 20 minutes)

### 1. Supabase (the database)
1. Go to **supabase.com** → **New project**. Name: `TutoringHub`. Region: **Southeast Asia (Singapore)**. Save the database password somewhere safe.
2. When it's ready, open **SQL Editor** → **New query**.
3. Paste everything in `supabase/migrations/0001_init.sql` → **Run**.
4. New query again → paste `supabase/migrations/0002_storage.sql` → **Run**.
5. Go to **Project Settings → API Keys** (or **Data API**) and copy:
   - Project URL
   - Publishable key (or "anon public" key)
   - Secret key (or "service_role" key) — keep this one private.

### 2. Google sign-in
1. **console.cloud.google.com** → your project (or a new one) → **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
2. **Authorised redirect URI**: `https://<your-project>.supabase.co/auth/v1/callback`
3. Copy the Client ID and Client secret.
4. In Supabase: **Authentication → Sign In / Providers → Google** → turn on, paste both → Save.

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
4. Back in Supabase: **Authentication → URL Configuration**:
   - Site URL: your Vercel address
   - Redirect URLs: add `https://<your-vercel-address>/auth/callback`

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
