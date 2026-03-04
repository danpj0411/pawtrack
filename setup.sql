-- ============================================================
-- PawTrack — Supabase Database Setup
-- Run this entire file in Supabase: SQL Editor → New query → Run
-- ============================================================

-- 1. DOGS TABLE
create table if not exists public.dogs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users on delete cascade not null,
  name         text not null,
  breed        text,
  weight_kg    numeric(5,2),
  age_years    numeric(4,1),
  owner_name   text,
  color        text default '#4f7942',
  notes        text,
  created_at   timestamptz default now() not null
);

-- 2. WALKS TABLE
create table if not exists public.walks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users on delete cascade not null,
  dog_id           uuid references public.dogs on delete cascade not null,
  started_at       timestamptz not null,
  finished_at      timestamptz,
  duration_seconds integer,
  route            jsonb default '[]'::jsonb,
  distance_meters  numeric(10,2) default 0,
  notes            text,
  created_at       timestamptz default now() not null
);

-- 3. INDEXES
create index if not exists dogs_user_id_idx   on public.dogs (user_id);
create index if not exists walks_user_id_idx  on public.walks (user_id);
create index if not exists walks_dog_id_idx   on public.walks (dog_id);
create index if not exists walks_started_idx  on public.walks (started_at desc);

-- 4. ROW LEVEL SECURITY — dogs
alter table public.dogs enable row level security;

create policy "Users can read own dogs"
  on public.dogs for select
  using (auth.uid() = user_id);

create policy "Users can insert own dogs"
  on public.dogs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own dogs"
  on public.dogs for update
  using (auth.uid() = user_id);

create policy "Users can delete own dogs"
  on public.dogs for delete
  using (auth.uid() = user_id);

-- 5. ROW LEVEL SECURITY — walks
alter table public.walks enable row level security;

create policy "Users can read own walks"
  on public.walks for select
  using (auth.uid() = user_id);

create policy "Users can insert own walks"
  on public.walks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own walks"
  on public.walks for update
  using (auth.uid() = user_id);

create policy "Users can delete own walks"
  on public.walks for delete
  using (auth.uid() = user_id);
