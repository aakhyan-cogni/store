import type postgres from "postgres";

/**
 * What a repository needs: either the connection pool or a transaction handle.
 * Repositories take this so the same method can run standalone or as one step
 * of a transaction (see `OrderRepository.checkout`).
 */
export type Database = postgres.Sql | postgres.TransactionSql;
