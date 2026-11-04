-- VIP for trucks & SUVs is a flat $550 (owner confirmed), not "$550+".
-- The seed never overwrites existing rows, so update the live copy here. Each UPDATE only matches
-- the original seed wording, so a summary or description the owner already edited in admin is left alone.
-- On a fresh database the table is still empty at this point and the seed inserts the new wording.

UPDATE services
SET summary = 'Everything in Gold, plus one-step paint correction and a 1-year ceramic coating.'
WHERE slug = 'vip-showroom-finish'
  AND summary = 'Everything in Gold, plus one-step paint correction and a 1-year ceramic coating. Trucks & SUVs start at $550+.';

UPDATE services
SET description_md = replace(description_md, 'Cars start at $450; trucks and SUVs start at $550+.', 'Cars are $450; trucks and SUVs are $550.')
WHERE slug = 'vip-showroom-finish'
  AND description_md LIKE '%Cars start at $450; trucks and SUVs start at $550+.%';
