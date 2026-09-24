-- UP
-- Both columns had a DEFAULT but no NOT NULL, so an explicit NULL was legal.
-- A NULL stock passes CHECK (stock >= 0), and a NULL is_active is excluded by
-- every "WHERE is_active = TRUE" read, so such a product silently vanishes
-- from the catalogue while still existing. Backfill, then forbid it.
UPDATE products
SET is_active = TRUE
WHERE is_active IS NULL;

UPDATE products
SET stock = 0
WHERE stock IS NULL;

ALTER TABLE products
ALTER COLUMN is_active
SET NOT NULL;

ALTER TABLE products
ALTER COLUMN stock
SET NOT NULL;

-- DOWN
ALTER TABLE products
ALTER COLUMN is_active
DROP NOT NULL;

ALTER TABLE products
ALTER COLUMN stock
DROP NOT NULL;
