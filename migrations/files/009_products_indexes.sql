-- UP
-- Postgres does not index the referencing side of a foreign key, so filtering
-- products by category and the RESTRICT check on deleting a category were both
-- sequential scans. The second index covers the hot read path: every catalogue
-- query filters on is_active = TRUE and orders by id.
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);

CREATE INDEX IF NOT EXISTS idx_products_listed ON products (id)
WHERE
    is_active = TRUE;

-- DOWN
DROP INDEX IF EXISTS idx_products_category_id;

DROP INDEX IF EXISTS idx_products_listed;
