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

-- ------------------------------------------------------------------
-- Fase 3: team reale con Claude Code (incolla ed esegui anche questa parte)
-- ------------------------------------------------------------------

-- Eventi inviati da Claude Code (hook) e dal motore locale: la stanza mostra il lavoro vero
create table if not exists public.agent_events (
  id bigint generated always as identity primary key,
  project_id text not null,
  role text not null,
  status text,
  text text not null,
  level text not null default 'info',
  created_at timestamptz not null default now()
);
create index if not exists agent_events_project_created on public.agent_events (project_id, created_at desc);
alter table public.agent_events enable row level security;

-- Richieste "Lavora con il team" dalla dashboard al motore locale sul PC
create table if not exists public.launch_requests (
  id bigint generated always as identity primary key,
  project_id text not null,
  task_id text,
  template text,
  brief text not null,
  status text not null default 'pending',
  note text,
  created_at timestamptz not null default now()
);
alter table public.launch_requests enable row level security;
