-- Open 7 days a week: Sunday 8 AM–6 PM, same as weekdays (owner's request).
-- The seed only fills business_hours when the table is empty, so add Sunday to the live data here.
-- Skipped when Sunday already has hours (set in admin), and on a fresh database, where the table is
-- still empty at this point and the seed inserts the full week, Sunday included.

INSERT INTO business_hours (weekday, opens, closes)
SELECT 7, '08:00', '18:00'
WHERE NOT EXISTS (SELECT 1 FROM business_hours WHERE weekday = 7)
  AND EXISTS (SELECT 1 FROM business_hours);
