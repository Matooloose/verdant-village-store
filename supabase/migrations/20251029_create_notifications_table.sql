-- Create a simple per-user notifications table and RLS policies
-- Target: per-user notifications (notifications.user_id = recipient). For broadcasts, insert rows for each user.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  message text not null,
  type text not null default 'admin',
  action_url text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Index for querying recent notifications for a user
create index if not exists idx_notifications_user_created_at on public.notifications (user_id, created_at desc);

-- Enable row level security
alter table public.notifications enable row level security;

-- Policy: allow authenticated users to select their own notifications
-- Note: auth.uid() returns the current user's id as text; user_id is uuid, so cast auth.uid() to uuid
create policy "select_own_notifications" on public.notifications
  for select
  using (auth.uid()::uuid = user_id);

-- Policy: allow inserts where the user creating the notification is the target user OR service role (allow server writes)
create policy "insert_notifications" on public.notifications
  for insert
  with check (auth.role() = 'supabase_admin' OR auth.uid()::uuid = user_id);

-- Policy: allow update only for the owner to set read = true (or any update to their rows)
create policy "update_own_notifications" on public.notifications
  for update
  using (auth.uid()::uuid = user_id)
  with check (auth.uid()::uuid = user_id);

-- Policy: allow delete only for server or owner (optional)
create policy "delete_notifications" on public.notifications
  for delete
  using (auth.role() = 'supabase_admin' OR auth.uid()::uuid = user_id);

-- Note: depending on your Supabase setup, the `auth.uid()` returns the user's id as text; if your user ids are uuid typed, adjust accordingly.
