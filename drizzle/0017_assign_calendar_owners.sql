-- Add calendar owners as participants to all existing synced events
-- where they're not already a participant

INSERT INTO event_participants (id, event_id, family_member_id, is_owner, created_at)
SELECT
  gen_random_uuid()::text,
  e.id,
  fm.id,
  false,
  now()
FROM events e
INNER JOIN google_calendars gc ON e.google_calendar_id = gc.id
INNER JOIN accounts a ON gc.account_id = a.id
INNER JOIN family_members fm ON fm.user_id = a.user_id AND fm.family_id = gc.family_id
WHERE NOT EXISTS (
  SELECT 1 FROM event_participants ep
  WHERE ep.event_id = e.id AND ep.family_member_id = fm.id
);
