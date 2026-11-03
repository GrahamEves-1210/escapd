-- =============================================================================
-- Eight photos per room
-- =============================================================================
-- The camera's default lens (1x) now shoots the 360 in the sensor's own 3:4,
-- 53 degrees across, so a full turn is 8 photos 45 degrees apart with about
-- 15 % shared between neighbours (src/capture/turn.ts; the 0.5x lens takes 6).
-- The cap was 6, so the storage trigger (public.register_room_photo, which
-- reads private.config_int('max_photos_per_room')) would refuse photos 7 and
-- 8. room_photos.position already allows 0 to 11, and the only other reader of
-- the limit, public.get_my_access() (gameplay.sql, max_photos_per_room for
-- the app), reads this same row, so this row is the only change.
-- =============================================================================

update private.app_config
   set value = '8'::jsonb,
       description = 'Maximum photos per room (1x''s full turn: 8 photos 45 degrees apart)',
       updated_at = now()
 where key = 'max_photos_per_room';
