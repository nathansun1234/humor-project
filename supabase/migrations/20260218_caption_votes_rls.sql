-- caption_votes hardening for one-vote-per-profile-per-caption

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
