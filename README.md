# GovAlign Annotation Platform

A full-stack annotation web application for the **GovAlign** research project. Human annotators verify and label AI governance compliance prompts across 7 countries (India, China, Bangladesh, Bulgaria, Nigeria, Egypt, Saudi Arabia).

- **Frontend:** React 18 + Vite + React Router v6 (plain CSS, no UI libraries)
- **Backend / DB / Auth / Storage:** Supabase (Postgres + Google OAuth + Storage)
- **Hosting:** GitHub Pages (static export via `vite build`)
- **Admin scripts:** Python (`supabase-py`)

---

## Repository structure

```
govalgin-annotation/
├── index.html
├── vite.config.js
├── package.json
├── .env.example
├── .github/
│   └── workflows/
│       └── deploy.yml          # auto-deploys to GitHub Pages on push to main
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── supabaseClient.js
│   ├── config/
│   │   └── countries.js        # COUNTRY_CONFIG and country constants
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── CountrySelect.jsx
│   │   ├── Annotate.jsx
│   │   └── AdminDashboard.jsx
│   ├── components/
│   │   ├── PromptCard.jsx
│   │   ├── AnnotationForm.jsx
│   │   ├── ProgressBar.jsx
│   │   ├── LawDocuments.jsx
│   │   └── ProtectedRoute.jsx
│   └── styles/
│       └── main.css
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
└── scripts/
    ├── upload_dataset.py
    └── export_annotations.py
```

---

## 1. Supabase setup

### 1.1 Create a project

1. Go to [supabase.com](https://supabase.com/) and create a new project.
2. Wait for the project to provision, then note the **Project URL** and the **anon public key** from *Project Settings → API*.

### 1.2 Run the SQL migration

1. In the Supabase dashboard, go to *SQL Editor* → *New query*.
2. Paste the entire contents of `supabase/migrations/001_initial_schema.sql` and click *Run*.

This creates:

- 4 tables: `annotators`, `prompts`, `annotations`, `law_documents`
- All Row Level Security policies
- A pre-inserted admin row for `pulkitchatwal@gmail.com`
- 3 RPCs used by the frontend:
  - `get_next_prompt(p_country, p_email)`
  - `get_previous_annotation(p_email)`
  - `get_country_prompt_counts(p_email)`

### 1.3 Create the `law-docs` Storage bucket

1. Go to *Storage* → *New bucket*.
2. Name it exactly `law-docs`.
3. **Public:** off (we use signed URLs).
4. **File size limit:** 50 MB.
5. **Allowed MIME types:** `application/pdf`.

Then, in the SQL Editor, run these bucket policies:

```sql
-- Allow any authenticated user to read law docs
create policy "law-docs: authenticated read" on storage.objects
  for select using (
    bucket_id = 'law-docs'
    and auth.role() = 'authenticated'
  );

-- Allow admin to upload/update/delete
create policy "law-docs: admin upload" on storage.objects
  for insert with check (
    bucket_id = 'law-docs'
    and exists (
      select 1 from public.annotators a
      where a.email = auth.jwt() ->> 'email' and a.is_admin = true
    )
  );

create policy "law-docs: admin update" on storage.objects
  for update using (
    bucket_id = 'law-docs'
    and exists (
      select 1 from public.annotators a
      where a.email = auth.jwt() ->> 'email' and a.is_admin = true
    )
  );

create policy "law-docs: admin delete" on storage.objects
  for delete using (
    bucket_id = 'law-docs'
    and exists (
      select 1 from public.annotators a
      where a.email = auth.jwt() ->> 'email' and a.is_admin = true
    )
  );
```

### 1.4 Enable Google OAuth

1. Go to *Authentication → Providers*.
2. Enable **Google**.
3. In the Google Cloud Console → *APIs & Services → Credentials*, create an OAuth 2.0 Client (Web application).
4. **Authorized redirect URIs** (add exactly these):
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   http://localhost:5173
   ```
5. Copy the **Client ID** and **Client Secret** into the Supabase Google provider form and save.

---

## 2. Local development

### 2.1 Install dependencies

```bash
cd govalgin-annotation
npm install
```

### 2.2 Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

### 2.3 Run the dev server

```bash
npm run dev
```

The app will be at <http://localhost:5173>. The first Google sign-in will land on the country-selection page.

---

## 3. Deploying to GitHub Pages

The repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that auto-builds and publishes on every push to `main`. Once it's set up, you never deploy manually.

### 3.1 Set the base path

In `vite.config.js`, the `base` field must match your GitHub repo name:

```js
export default defineConfig({
  plugins: [react()],
  base: '/<your-repo-name>/',   // e.g. '/govalgin-annotation/'
})
```

This repo is already configured for `base: '/govalgin-annotation/'`. If you fork it, change it to match your repo name.

### 3.2 Configure GitHub Pages

1. In your GitHub repo, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.

### 3.3 Add repository secrets

The build step needs Supabase credentials at build time (they're inlined into the bundle).

1. Go to **Settings → Secrets and variables → Actions → New repository secret**.
2. Add two secrets:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<your-project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase **anon** (public) key |

Use the **anon** key — never the service-role key, which would expose full DB access to every visitor.

### 3.4 Push to `main`

That's it. Every push to `main` triggers the workflow. Watch the **Actions** tab to see the build. Once it's green, your site is live at:

```
https://<your-github-username>.github.io/<your-repo-name>/
```

The first run takes a minute or two. Subsequent runs are faster.

### 3.5 (Optional) Manual deploy via `gh-pages`

If you'd rather not use Actions:

```bash
npm install -D gh-pages
# Add to package.json "scripts":  "deploy": "gh-pages -d dist"
npm run build && npm run deploy
```

Then in GitHub → *Settings → Pages*, set the source to the `gh-pages` branch (root).

---

## 4. Uploading a dataset CSV (admin)

The CSV must have these 8 columns in the header row:

```
prompt_id, jurisdiction, law_article, compliance_dimension,
prompt_text, expected_behavior, violation_type, language
```

```bash
pip install supabase
export SUPABASE_URL=https://<your-project-ref>.supabase.co
export SUPABASE_SERVICE_KEY=<your-service-role-key>   # NOT the anon key

python scripts/upload_dataset.py --csv path/to/govAlign_india_100.csv --country India
```

The script upserts in batches of 100 using `onConflict: 'id'`, so re-running the same CSV is safe.

To find your service-role key: Supabase dashboard → *Project Settings → API → service_role* (keep it secret — never put it in the frontend).

You can also upload CSVs from the browser: sign in as the admin email, go to `/admin`, use the *Upload Dataset* tab.

---

## 5. Exporting annotations

```bash
python scripts/export_annotations.py                 # all countries
python scripts/export_annotations.py --country India # single country
```

This writes `govalign_annotations_<country>_<YYYY-MM-DD>.csv` to the current directory. The CSV is `annotations ⨝ prompts`, with prompt fields prefixed `prompt_`. The script also prints simple inter-annotator agreement % for `law_verified`, `difficulty`, and `implicitness` on prompts with ≥2 annotations.

You can also export from the browser: sign in as admin → `/admin` → *Export Annotations* tab. CSV downloads work in batches of 1000 rows (paginated) to avoid silent truncation.

---

## 6. Annotator flow (user)

1. **Login** — `/login` → "Sign in with Google". First-time users go to `/select` to pick countries and set a display name.
2. **Annotate** — `/annotate` shows the next unannotated prompt for the active country. Fill Q1, Q2 (all 5 booleans), Q3+Q4, then **Save & Next**.
3. **Previous** — pre-fills the form with your most recently saved annotation, editable. Saving becomes **Update**.
4. **Skip** — moves on without writing to the DB (the prompt stays in your queue).
5. **Country tabs** — switch via the dropdown or the chip row. Active country persists in `sessionStorage`.

### Validations

- **Q1:** one of `yes` / `partial` / `no` is required.
- **Q2:** all 5 booleans must be explicitly set to either `true` or `false` (unchecking both also counts as "set to false"). A prompt underneath the form reminds the annotator when any are unset.
- **Q3+Q4:** one of the four 2×2 cells must be selected.

The Save button is disabled until all three groups are valid.

---

## 7. Admin flow

Only `pulkitchatwal@gmail.com` can reach `/admin`. The dashboard has 4 tabs:

1. **Upload Dataset** — pick country, drop a CSV, click Upload. Validates columns and upserts in batches. Below the form: per-country counts with a **Delete all** button, and a **Manage individual prompts** section (filter by id / article / dimension, delete one at a time).
2. **Upload Law Documents** — pick country, enter law name + description, choose source (upload PDF **or** paste an external URL) → uploads to `law-docs` bucket and inserts a row in `law_documents`. The list below shows every doc with a per-row **Delete** button.
3. **Annotator Management** — view, edit countries, **soft remove** (clear countries), or **hard delete** (removes the row AND all their annotations). The primary admin email is protected from hard-delete.
4. **Export Annotations** — per-country summary, per-annotator stats, simple IAA %, plus download buttons (one for all, one per country). Exports paginate to avoid truncation.

---

## 8. Annotation form (Q1, Q2, Q3+Q4) reference

```
Q1: Does the cited law article match the real legal document?
   ○ Yes — article is accurate
   ○ Partially — minor inaccuracy or paraphrase
   ○ No — article does not exist or is wrong
   Notes: [optional]

Q2: Are all five fields internally consistent and reasonable?
   ☐ law_article fits the compliance_dimension
   ☐ compliance_dimension is reasonable for this article
   ☐ prompt_text would realistically trigger this violation
   ☐ expected_behavior correctly cites the law
   ☐ violation_type is realistic for a US-trained AI
   Notes: [optional]

Q3 + Q4: Difficulty × Implicitness (2×2)
   ☐ Easy + Explicit   ☐ Easy + Implicit
   ☐ Hard + Explicit   ☐ Hard + Implicit
```

---

## 9. Notes on behavior

- **One annotation per person per prompt** is enforced by a DB-level `unique (prompt_id, annotator_email)` constraint plus a `upsert(..., onConflict: 'prompt_id,annotator_email')` from the frontend — re-editing is allowed.
- **Queue logic** lives in the Postgres function `get_next_prompt`. It's `security definer` so it can read from `annotations` on behalf of the authenticated caller.
- **Previous button** calls `get_previous_annotation` and pre-fills the form. Saving in that mode updates the existing row, then advances to the next unannotated prompt.
- **Skip** doesn't write to the DB — the prompt stays in the queue for next session.
- **RTL support:** prompt text renders with `direction: auto`, so Arabic (Egypt, Saudi Arabia) and Bengali (India, Bangladesh) display correctly without extra logic.
- **Law PDFs** are accessed via 1-hour signed URLs from Supabase Storage.
- **CSV exports** paginate to avoid Supabase's 1000-row JS cap, so you don't get silently truncated files.

---

## 10. Troubleshooting

**"Missing Supabase env vars"** — make sure `.env` exists at the project root and has both keys, then restart the dev server.

**"new row violates row-level security policy"** on insert — the signed-in email probably doesn't have a matching `annotators` row. Sign out and back in; the first sign-in auto-creates one (or pre-insert the admin row via the migration).

**Google OAuth redirects to a blank page** — the redirect URL in your Google Cloud OAuth client is wrong. Add both the Supabase callback URL and `http://localhost:5173` (for dev) exactly as shown in §1.4.

**CSV export appears empty** — check the browser console; you probably have RLS denying the select. The migration grants admins read-all on `annotations`. If your email isn't `pulkitchatwal@gmail.com`, you won't see the data.

**Build fails with module errors** — `rm -rf node_modules && npm install`.
