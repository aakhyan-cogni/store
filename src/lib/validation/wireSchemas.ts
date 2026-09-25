import type { ContractSchema } from "../structures/Route.js";
import { API_ERROR_CODES } from "../responses.js";
import { z, type ZodType } from "zod";
import { userSchema } from "./authSchema.js";
import { dbCartItemSchema, publicCartItemSchema } from "./cartSchema.js";
import { dbCategorySchema } from "./categorySchema.js";
import { publicOrderItemSchema, publicOrderSchema } from "./orderSchema.js";
import { dbProductSchema, publicProductSchema } from "./productSchema.js";

export interface NamedWireSchema extends ContractSchema {
	componentName: string;
}

function namedWireSchema(componentName: string, schema: ZodType): NamedWireSchema {
	return { componentName, schema };
}

/** `Date#toJSON` is the serialization used by every current dated response. */
export const serializedDateTimeSchema = z.iso.datetime();

const productValueSchema = publicProductSchema.extend({ created_at: serializedDateTimeSchema });
const createdProductValueSchema = dbProductSchema.extend({ created_at: serializedDateTimeSchema });
const categoryValueSchema = dbCategorySchema;
const cartItemValueSchema = publicCartItemSchema;
const cartMutationResultValueSchema = dbCartItemSchema.extend({ created_at: serializedDateTimeSchema });
const orderSummaryValueSchema = publicOrderSchema.extend({ created_at: serializedDateTimeSchema });
const orderValueSchema = orderSummaryValueSchema.extend({ items: z.array(publicOrderItemSchema) });
const userValueSchema = userSchema.extend({ created_at: serializedDateTimeSchema });
const tokenValueSchema = z.object({ token: z.string() });
const healthValueSchema = z.object({ status: z.literal("ok"), timestamp: z.int().nonnegative() });
const paginationValueSchema = z.object({
	limit: z.int().positive(),
	offset: z.int().nonnegative(),
	total: z.int().nonnegative(),
});
const validationDetailValueSchema = z.object({ field: z.string(), message: z.string() });
const errorValueSchema = z.object({
	code: z.enum(API_ERROR_CODES),
	message: z.string(),
	details: z.unknown().optional(),
});

/** A listed Product returned by public browse and update operations. */
export const productWireSchema = namedWireSchema("Product", productValueSchema);
export const productListWireSchema = namedWireSchema("ProductList", z.array(productValueSchema));

/**
 * Product creation currently returns the database-shaped Product, including
 * its listing flag. This schema records that response without changing it.
 */
export const createdProductWireSchema = namedWireSchema("CreatedProduct", createdProductValueSchema);

export const categoryWireSchema = namedWireSchema("Category", categoryValueSchema);
export const categoryListWireSchema = namedWireSchema("CategoryList", z.array(categoryValueSchema));

/** The enriched Cart item returned when a User reads their Cart. */
export const cartItemWireSchema = namedWireSchema("CartItem", cartItemValueSchema);
export const cartWireSchema = namedWireSchema("Cart", z.array(cartItemValueSchema));

/**
 * Cart add and update operations currently expose the stored row. Keep the
 * database-shaped fields in the contract until runtime behavior changes.
 */
export const cartMutationResultWireSchema = namedWireSchema("CartMutationResult", cartMutationResultValueSchema);

export const orderSummaryWireSchema = namedWireSchema("OrderSummary", orderSummaryValueSchema);
export const orderListWireSchema = namedWireSchema("OrderList", z.array(orderSummaryValueSchema));
export const orderWireSchema = namedWireSchema("Order", orderValueSchema);

export const userWireSchema = namedWireSchema("User", userValueSchema);
export const tokenWireSchema = namedWireSchema("Token", tokenValueSchema);
export const healthWireSchema = namedWireSchema("Health", healthValueSchema);
export const paginationWireSchema = namedWireSchema("Pagination", paginationValueSchema);
export const validationDetailWireSchema = namedWireSchema("ValidationDetail", validationDetailValueSchema);
export const validationDetailsWireSchema = namedWireSchema("ValidationDetails", z.array(validationDetailValueSchema));
export const errorWireSchema = namedWireSchema("Error", errorValueSchema);
export const errorResponseWireSchema = namedWireSchema("ErrorResponse", z.object({ error: errorValueSchema }));

/** All built-in components, in deterministic component-name order. */
export const wireSchemas = [
	cartWireSchema,
	cartItemWireSchema,
	cartMutationResultWireSchema,
	categoryWireSchema,
	categoryListWireSchema,
	createdProductWireSchema,
	errorWireSchema,
	errorResponseWireSchema,
	healthWireSchema,
	orderWireSchema,
	orderListWireSchema,
	orderSummaryWireSchema,
	paginationWireSchema,
	productWireSchema,
	productListWireSchema,
	tokenWireSchema,
	userWireSchema,
	validationDetailWireSchema,
	validationDetailsWireSchema,
] as const satisfies readonly NamedWireSchema[];
