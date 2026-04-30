/**
 * Barrel export for the shared module.
 *
 * Import from `@/_shared` (mobile) or `../_shared` (server) so callers
 * don't have to know which file the symbol lives in.
 */

export * from "./status";
export * from "./transitions";
export * from "./trackPhase";
export * from "./socketEvents";
export * from "./format";
export * from "./idempotency";
