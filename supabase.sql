-- À coller une seule fois dans Supabase : SQL Editor > New query > Run
-- Une ligne par joueur : son pseudo et toute sa partie (cartes, pièces, boosters...).
create table if not exists public.saves (
  id uuid primary key references auth.users on delete cascade,
  pseudo text unique not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Sécurité : chaque joueur ne peut lire et modifier QUE sa propre partie.
alter table public.saves enable row level security;

create policy "lire sa partie" on public.saves
  for select using (auth.uid() = id);
create policy "creer sa partie" on public.saves
  for insert with check (auth.uid() = id);
create policy "modifier sa partie" on public.saves
  for update using (auth.uid() = id) with check (auth.uid() = id);
