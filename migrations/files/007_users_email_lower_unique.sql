-- UP
-- The UNIQUE constraint on users.email is case-sensitive, so Alice@example.com
-- and alice@example.com were two accounts. Existing addresses are folded to
-- lower case first, because lookups now match on lower(email) and a stored
-- mixed-case address would otherwise become unfindable. If two accounts differ
-- only by case this migration fails, which is the honest outcome: merging them
-- is a decision, not a migration.
UPDATE users
SET email = lower(email)
WHERE email <> lower(email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));

-- DOWN
DROP INDEX IF EXISTS idx_users_email_lower;
