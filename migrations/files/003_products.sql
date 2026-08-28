-- UP
CREATE TABLE IF NOT EXISTS
    products (
        id SERIAL PRIMARY KEY,
        is_active BOOLEAN DEFAULT TRUE,
        category_id INT NOT NULL,
        NAME VARCHAR(100) NOT NULL,
        description TEXT,
        price NUMERIC(10, 2) NOT NULL,
        stock INT DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_products_categories FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT,
        CONSTRAINT chk_products_price CHECK (price >= 0),
        CONSTRAINT chk_products_stock CHECK (stock >= 0)
    );

-- DOWN
DROP TABLE IF EXISTS products;