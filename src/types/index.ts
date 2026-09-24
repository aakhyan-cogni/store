export * from "./enums/index.js";
export * from "./utils.js";
export type Awaitable<T> = Promise<T> | T;

/** Every method this API implements. The one source for both routing and `Allow`. */
export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export type HTTPMethod = (typeof HTTP_METHODS)[number];

export type UserRole = "ADMIN" | "USER";
