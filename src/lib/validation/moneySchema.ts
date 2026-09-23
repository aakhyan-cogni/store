import { z } from "zod";

/**
 * A money amount as `NUMERIC(10,2)` renders it: whole units, optionally one
 * or two decimal places. The capture groups are what `toMinorUnits` reads.
 */
export const MONEY_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

export const moneyStringSchema = z.string().regex(MONEY_PATTERN, "must be an amount like '9.99'");
