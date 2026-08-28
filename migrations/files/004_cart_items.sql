-- UP
CREATE TABLE IF NOT EXISTS
    cart_items (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, product_id),
        CONSTRAINT fk_cart_items_users FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_cart_items_products FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
        CONSTRAINT chk_cart_items_quantity CHECK (quantity > 0)
    );

-- DOWN
DROP TABLE IF EXISTS cart_items;