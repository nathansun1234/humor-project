-- caption_votes hardening for one-vote-per-profile-per-caption with fast RLS checks

alter table public.caption_votes enable row level security;

create index if not exists caption_votes_profile_id_idx
  on public.caption_votes (profile_id);

create index if not exists caption_votes_caption_id_idx
  on public.caption_votes (caption_id);

create unique index if not exists caption_votes_profile_caption_unique_idx
  on public.caption_votes (profile_id, caption_id);

alter table public.caption_votes
  drop constraint if exists caption_votes_vote_check;

alter table public.caption_votes
  add constraint caption_votes_vote_check check (vote_value in (-1, 1));

drop policy if exists "caption_votes_select_own" on public.caption_votes;
create policy "caption_votes_select_own"
on public.caption_votes
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = profile_id
);

drop policy if exists "caption_votes_insert_own" on public.caption_votes;
create policy "caption_votes_insert_own"
on public.caption_votes
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = profile_id
);

drop policy if exists "caption_votes_update_own" on public.caption_votes;
create policy "caption_votes_update_own"
on public.caption_votes
for update
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = profile_id
)
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = profile_id
);

drop policy if exists "caption_votes_delete_own" on public.caption_votes;
create policy "caption_votes_delete_own"
on public.caption_votes
for delete
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = profile_id
);
