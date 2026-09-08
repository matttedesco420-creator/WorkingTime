-- ============================================================
-- WorkTime — Supabase Schema
-- Einmalig im Supabase-Dashboard unter "SQL Editor" ausführen.
-- Voraussetzung: Supabase Auth ist aktiviert (Standard).
-- ============================================================

-- ---------- Tabellen ----------

-- Profil (Vorname/Nachname/Berufung) des Handy-Besitzers, 1:1 zu auth.users.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  role text,
  updated_at timestamptz not null default now()
);

-- Weitere Mitarbeiter (max. 3, wird in der App begrenzt), "position" hält die
-- Anzeigereihenfolge.
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- Projekte (kein Kostenstellen-/Labor-Konzept in dieser App).
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text,
  name text not null,
  description text,
  color text,
  created_at timestamptz not null default now()
);

-- Ein Eintrag pro Person pro Arbeitssitzung (Timer-Feierabend oder manuell
-- erfasst). "worker" ist bewusst Klartext, kein Fremdschlüssel — der Name wird
-- zum Erfassungszeitpunkt festgehalten und ändert sich nicht rückwirkend,
-- falls ein Mitarbeiter später umbenannt wird.
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  worker text not null,
  date date not null,
  start_time text,
  end_time text,
  pause_hours numeric not null default 0,
  hours numeric not null default 0,
  activity text,
  materials jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Laufende Timer-Sitzungen (BEREIT/LÄUFT/PAUSE/ABSCHLUSS). Wird synchronisiert,
-- damit ein zweites Gerät mit demselben Konto den aktuellen Stand sieht.
create table if not exists public.timers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  is_owner boolean not null default false,
  worker text not null default '',
  project_id uuid references public.projects(id) on delete set null,
  status text not null default 'idle',
  started_at timestamptz,
  accumulated_ms bigint not null default 0,
  session_date date,
  session_start_clock text,
  updated_at timestamptz not null default now()
);

-- ---------- Indizes ----------

create index if not exists workers_user_idx on public.workers(user_id);
create index if not exists projects_user_idx on public.projects(user_id);
create index if not exists entries_user_date_idx on public.entries(user_id, date);
create index if not exists entries_project_idx on public.entries(project_id);
create index if not exists timers_user_idx on public.timers(user_id);

-- ---------- Row Level Security ----------
-- Jede Zeile gehört genau einem Nutzer (user_id = auth.uid()).
-- Damit sehen/ändern Kolleg:innen nur ihre eigenen Daten, egal von welchem Gerät.

alter table public.profiles enable row level security;
alter table public.workers  enable row level security;
alter table public.projects enable row level security;
alter table public.entries  enable row level security;
alter table public.timers   enable row level security;

-- "drop policy if exists" davor macht das Skript gefahrlos wiederholbar.
drop policy if exists "own rows" on public.profiles;
create policy "own rows" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on public.workers;
create policy "own rows" on public.workers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on public.projects;
create policy "own rows" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on public.entries;
create policy "own rows" on public.entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on public.timers;
create policy "own rows" on public.timers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Realtime ----------
-- Aktiviert Live-Updates, damit ein zweites Gerät mit demselben Konto
-- Änderungen automatisch mitbekommt (ohne Neuladen).
-- Der DO-Block überspringt Tabellen, die bereits registriert sind, damit ein
-- erneutes Ausführen des Skripts nicht mit "already member of publication"
-- abbricht.

do $$
declare t text;
begin
  foreach t in array array['profiles', 'workers', 'projects', 'entries', 'timers'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
