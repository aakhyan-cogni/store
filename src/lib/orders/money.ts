import { MONEY_PATTERN } from "../validation/moneySchema.js";

const MINOR_UNITS_PER_UNIT = 100;

/**
 * Reads a Postgres `NUMERIC(10,2)` value — which arrives as a string — into
 * whole minor units (cents), so money is never held as a float.
 */
export function toMinorUnits(price: string) {
	const match = MONEY_PATTERN.exec(price.trim());
	if (!match) throw new Error(`Unreadable price: '${price}'`);

	const [, units, fraction = ""] = match;
	return Number(units) * MINOR_UNITS_PER_UNIT + Number(fraction.padEnd(2, "0"));
}

/** Renders whole minor units back to the two-decimal string Postgres expects. */
export function toPriceString(minorUnits: number) {
	const units = Math.trunc(minorUnits / MINOR_UNITS_PER_UNIT);
	const fraction = minorUnits % MINOR_UNITS_PER_UNIT;
	return `${units}.${String(fraction).padStart(2, "0")}`;
}
