-- 001_initial_schema.sql — GovAlign Annotation Platform
-- Run this in the Supabase SQL editor for your project.
-- It creates tables, RLS policies, indexes, the admin pre-insert, and the
-- three RPCs used by the frontend (get_next_prompt, get_previous_annotation,
-- get_country_prompt_counts).

-- ── Enable UUID generation ─────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Annotators ─────────────────────────────────────────────────────────────────
create table public.annotators (
  id           uuid primary key default gen_random_uuid(),
  email        text unique not null,
  name         text not null,
  is_admin     boolean default false,
  countries    text[] default '{}',
  created_at   timestamptz default now()
);

-- Admin record (always exists)
insert into public.annotators (email, name, is_admin, countries)
values (
  'pulkitchatwal@gmail.com',
  'Pulkit Chatwal',
  true,
  ARRAY['India','China','Bangladesh','Bulgaria','Nigeria','Egypt','Saudi Arabia']
);

-- ── Prompts ────────────────────────────────────────────────────────────────────
create table public.prompts (
  id                   text primary key,           -- e.g. DPDPA-CONSENT-001
  country              text not null,              -- India | China | Bangladesh | Bulgaria | Nigeria | Egypt | Saudi Arabia
  jurisdiction         text,
  law_article          text,
  compliance_dimension text,
  prompt_text          text,
  expected_behavior    text,
  violation_type       text,
  language             text,
  uploaded_by          text,
  uploaded_at          timestamptz default now()
);

create index prompts_country_idx on public.prompts (country);

-- ── Law Documents (Supabase Storage references) ───────────────────────────────
create table public.law_documents (
  id           uuid primary key default gen_random_uuid(),
  country      text not null,
  law_name     text not null,        -- e.g. "DPDPA 2023"
  description  text,                 -- e.g. "Digital Personal Data Protection Act"
  filename     text not null,        -- e.g. "india_dpdpa_2023.pdf"
  storage_path text not null,        -- path inside Supabase Storage bucket "law-docs"
  uploaded_at  timestamptz default now()
);

create index law_documents_country_idx on public.law_documents (country);

-- ── Annotations ────────────────────────────────────────────────────────────────
create table public.annotations (
  id               uuid primary key default gen_random_uuid(),
  prompt_id        text not null references public.prompts(id) on delete cascade,
  annotator_email  text not null,
  annotator_name   text not null,
  country          text not null,

  -- Q1: Law article accuracy
  law_verified     text check (law_verified in ('yes', 'partial', 'no')),
  law_note         text,

  -- Q2: Field alignment (individual booleans per field)
  law_article_ok       boolean,
  dimension_ok         boolean,
  prompt_ok            boolean,
  expected_ok          boolean,
  violation_ok         boolean,
  alignment_note       text,

  -- Q3 + Q4: Difficulty and Implicitness (combined 2x2)
  difficulty           text check (difficulty in ('easy', 'hard')),
  implicitness         text check (implicitness in ('explicit', 'implicit')),

  -- Meta
  time_spent_sec   int,
  submitted_at     timestamptz default now(),

  unique (prompt_id, annotator_email)  -- one annotation per person per prompt
);

create index annotations_email_idx  on public.annotations (annotator_email);
create index annotations_country_idx on public.annotations (country);
create index annotations_prompt_idx on public.annotations (prompt_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.annotators    enable row level security;
alter table public.prompts       enable row level security;
alter table public.annotations   enable row level security;
alter table public.law_documents enable row level security;

-- ── Admin lookup table (no RLS — used to break policy recursion) ──────────────
-- We store admin emails in a separate table that has NO row level security.
-- This lets admin policies query it from within the `annotators` RLS context
-- without triggering the same policies again (which would cause infinite
-- recursion). Storing admin status in the main `annotators` table requires
-- either a SECURITY DEFINER helper (which Postgres still applies RLS to in
-- Supabase) or JWT custom claims (which require a separate Auth hook). A
-- tiny unprotected lookup table is the simplest reliable fix.
create table if not exists public.admins (
  email text primary key
);

-- Pre-seed the admin email.
insert into public.admins (email) values ('pulkitchatwal@gmail.com')
  on conflict do nothing;

-- ── Helper: is_admin(email) ───────────────────────────────────────────────────
-- Convenience wrapper around the unprotected `admins` table. Inlined into
-- the policies so we can use it from RLS contexts.
create or replace function public.is_admin(p_email text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admins where email = p_email)
$$;

-- Annotators: users can read their own row
create policy "annotators: read own" on public.annotators
  for select using (email = auth.jwt() ->> 'email');

-- Admin can read all annotators
create policy "annotators: admin read all" on public.annotators
  for select using (public.is_admin(auth.jwt() ->> 'email'));

-- Admin can update annotators
create policy "annotators: admin update" on public.annotators
  for update using (public.is_admin(auth.jwt() ->> 'email'));

-- Users can update their own row (CountrySelect needs this to save countries/name)
create policy "annotators: update own" on public.annotators
  for update using (email = auth.jwt() ->> 'email')
  with check (email = auth.jwt() ->> 'email');

-- Annotators: self-insert (first login creates record)
create policy "annotators: insert self" on public.annotators
  for insert with check (email = auth.jwt() ->> 'email');

-- Prompts: any authenticated user can read
create policy "prompts: authenticated read" on public.prompts
  for select using (auth.role() = 'authenticated');

-- Prompts: only admin can insert/update/delete
create policy "prompts: admin write" on public.prompts
  for all using (public.is_admin(auth.jwt() ->> 'email'));

-- Annotations: users can read and write their own
create policy "annotations: own" on public.annotations
  for all using (annotator_email = auth.jwt() ->> 'email');

-- Admin can read all annotations
create policy "annotations: admin read all" on public.annotations
  for select using (public.is_admin(auth.jwt() ->> 'email'));

-- Law documents: any authenticated user can read
create policy "law_docs: authenticated read" on public.law_documents
  for select using (auth.role() = 'authenticated');

-- Admin can manage law docs
create policy "law_docs: admin write" on public.law_documents
  for all using (public.is_admin(auth.jwt() ->> 'email'));

-- ── RPCs ──────────────────────────────────────────────────────────────────────
-- These exist because the Supabase JS client can't issue subqueries
-- (e.g. `prompt_id NOT IN (SELECT …)`) without server-side help.

-- Next unannotated prompt for an annotator in a given country.
create or replace function public.get_next_prompt(p_country text, p_email text)
returns setof public.prompts
language sql
security definer
set search_path = public
as $$
  select *
  from public.prompts
  where country = p_country
    and id not in (
      select prompt_id from public.annotations where annotator_email = p_email
    )
  order by id
  limit 1;
$$;

-- Most recent annotation by the annotator, joined with its prompt. The frontend
-- uses this to pre-fill the form when the user clicks "Previous".
create or replace function public.get_previous_annotation(p_email text)
returns table (
  annotation public.annotations,
  prompt     public.prompts
)
language sql
security definer
set search_path = public
as $$
  select a, p
  from public.annotations a
  join public.prompts p on p.id = a.prompt_id
  where a.annotator_email = p_email
  order by a.submitted_at desc
  limit 1;
$$;

-- Per-country prompt counts (total + done by this annotator). The frontend uses
-- this to render the progress chips in the country-select page and the annotate
-- header.
create or replace function public.get_country_prompt_counts(p_email text)
returns table (country text, total bigint, done bigint)
language sql
security definer
set search_path = public
as $$
  select
    p.country,
    count(*)::bigint as total,
    count(a.id)::bigint as done
  from public.prompts p
  left join public.annotations a
    on a.prompt_id = p.id and a.annotator_email = p_email
  group by p.country;
$$;

-- Grant execute on the RPCs to authenticated users
grant execute on function public.get_next_prompt(text, text) to authenticated;
grant execute on function public.get_previous_annotation(text) to authenticated;
grant execute on function public.get_country_prompt_counts(text) to authenticated;