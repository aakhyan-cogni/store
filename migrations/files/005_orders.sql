-- UP
CREATE TYPE order_status AS ENUM('PENDING', 'PAID', 'CANCELLED');

CREATE TABLE IF NOT EXISTS
    orders (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        total_amount NUMERIC(10, 2) NOT NULL,
        status order_status NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_orders_users FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT chk_orders_total_amount CHECK (total_amount >= 0)
    );

-- DOWN
DROP TABLE IF EXISTS orders;

DROP TYPE IF EXISTS order_status;