-- MDS Work: stato della dashboard (fase 2, step 1)
-- Incolla tutto in Supabase -> SQL Editor -> New query -> Run

create table if not exists public.app_state (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- RLS attiva e NESSUNA policy: la tabella e leggibile/scrivibile
-- solo dal server con la secret key, mai dal browser.
alter table public.app_state enable row level security;
