-- 013_creation_likes_owner_guard.sql
-- Prevent users from liking their own public creations at DB policy level

drop policy if exists creation_likes_insert_policy on creation_likes;
create policy creation_likes_insert_policy on creation_likes
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from creations c
      where c.id = creation_likes.creation_id
        and c.is_public = true
        and c.user_id <> auth.uid()
    )
  );
