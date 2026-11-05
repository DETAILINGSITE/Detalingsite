-- $50 non-refundable deposit, applied to the total (owner's request).
-- Settings are owned by admin after seeding, so update the live row here:
--  * deposit: $50 fixed, only if no deposit is configured yet (a deposit set in admin is kept);
--  * cancellation.depositRefundable = false, so the deposit is kept on any customer cancellation.
-- The deposit is only charged once Stripe keys are set; until then checkout skips it, as before.
-- On a fresh database the settings row doesn't exist yet and the seed writes these values.

UPDATE settings
SET data = jsonb_set(data, '{deposit}', '{"mode":"fixed","valueCents":5000}'::jsonb)
WHERE id = 1 AND data->'deposit'->>'mode' = 'none';

UPDATE settings
SET data = jsonb_set(data, '{cancellation,depositRefundable}', 'false'::jsonb)
WHERE id = 1 AND data ? 'cancellation';
