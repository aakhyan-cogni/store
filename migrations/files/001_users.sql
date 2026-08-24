-- UP
CREATE TYPE user_role AS ENUM('ADMIN', 'USER');

CREATE TABLE IF NOT EXISTS
    users (
        id SERIAL PRIMARY KEY,
        NAME VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        ROLE user_role NOT NULL DEFAULT 'USER',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- DOWN
DROP TABLE IF EXISTS users;

DROP TYPE IF EXISTS user_role;