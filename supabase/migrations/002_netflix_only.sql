-- ============================================================================
-- VYBE — Netflix-Only Platform Constraint
-- New Supabase migration: rooms are Netflix-only (platform = 'netflix').
-- Run in your Supabase SQL Editor.
-- ============================================================================

-- watch_rooms.platform
ALTER TABLE public.watch_rooms DROP CONSTRAINT IF EXISTS watch_rooms_platform_check;
ALTER TABLE public.watch_rooms
  ADD CONSTRAINT watch_rooms_platform_check CHECK (platform = 'netflix');

-- room_playback_state.platform
ALTER TABLE public.room_playback_state DROP CONSTRAINT IF EXISTS room_playback_state_platform_check;
ALTER TABLE public.room_playback_state
  ADD CONSTRAINT room_playback_state_platform_check CHECK (platform = 'netflix');

-- watch_queue_items.platform
ALTER TABLE public.watch_queue_items DROP CONSTRAINT IF EXISTS watch_queue_items_platform_check;
ALTER TABLE public.watch_queue_items
  ADD CONSTRAINT watch_queue_items_platform_check CHECK (platform = 'netflix');

-- Site movie library: netflix rows are the default set (already present from 001)
UPDATE public.watch_rooms
SET platform = 'netflix'
WHERE platform = 'youtube';
