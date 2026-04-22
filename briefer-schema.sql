-- Briefer v1 Schema
-- Run in Supabase SQL editor after enabling pgcrypto extension

create extension if not exists pgcrypto;

-- Users (extends Supabase auth.users)
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  timezone text not null default 'America/Los_Angeles',
  created_at timestamptz not null default now()
);
alter table public.users enable row level security;
create policy "users: own row" on public.users
  using (id = auth.uid()) with check (id = auth.uid());

-- User settings
create table public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null unique,
  morning_brief_enabled boolean not null default true,
  morning_brief_time time not null default '07:00',
  reminders_enabled boolean not null default false,
  reminder_times time[] not null default '{}',
  default_event_duration_minutes integer not null default 60,
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy "user_settings: own row" on public.user_settings
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Integrations (Google Calendar)
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  provider text not null check (provider = 'google_calendar'),
  access_token_encrypted text,
  refresh_token_encrypted text,
  calendar_id text,
  connected_at timestamptz,
  last_synced_at timestamptz,
  broken boolean not null default false,
  unique (user_id, provider)
);
alter table public.integrations enable row level security;
create policy "integrations: own row" on public.integrations
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Items (tasks + events)
create type public.item_type as enum ('task', 'event');
create type public.item_status as enum ('inbox', 'active', 'done', 'cancelled');
create type public.item_source as enum ('manual', 'siri', 'api', 'share_sheet');
create type public.item_tag as enum ('work', 'personal', 'errand', 'family', 'health', 'home', 'social');

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  type public.item_type not null default 'task',
  title text not null,
  notes text,
  due_at timestamptz,
  end_at timestamptz,
  duration_minutes integer,
  status public.item_status not null default 'inbox',
  tags public.item_tag[] not null default '{}',
  location text,
  raw_input text,
  classifier_confidence numeric(4,3),
  needs_review boolean not null default false,
  source public.item_source not null default 'manual',
  google_event_id text,
  google_etag text,
  sync_pending boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.items enable row level security;
create policy "items: own rows" on public.items
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Indexes
create index items_today_idx on public.items (user_id, status, due_at);
create index items_inbox_idx on public.items (user_id, created_at desc) where status = 'inbox';
create index items_review_idx on public.items (user_id) where needs_review = true;

-- Reminder log
create table public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  item_ids uuid[] not null default '{}',
  sent_at timestamptz not null default now(),
  channel text not null default 'email',
  status text not null default 'sent'
);
alter table public.reminder_log enable row level security;
create policy "reminder_log: own rows" on public.reminder_log
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Auto-update updated_at on items
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger items_updated_at before update on public.items
  for each row execute function public.set_updated_at();

-- Auto-create user row + settings after signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, display_name, timezone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'timezone', 'America/Los_Angeles')
  );
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
