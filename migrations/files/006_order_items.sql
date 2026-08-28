-- UP
CREATE TABLE IF NOT EXISTS
    order_items (
        id SERIAL PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INTEGER NOT NULL,
        price_at_purchase NUMERIC(10, 2) NOT NULL,
        CONSTRAINT fk_order_items_orders FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE RESTRICT,
        CONSTRAINT fk_order_items_products FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
        CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
        CONSTRAINT chk_order_items_price_at_purchase CHECK (price_at_purchase >= 0)
    );

-- DOWN
DROP TABLE IF EXISTS order_items;