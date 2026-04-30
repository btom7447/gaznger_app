/**
 * Re-export from the shared module. Older callers that imported
 * `@/lib/idempotency` keep working without churn; new code can pull
 * directly from `@/_shared`.
 */
export { newIdempotencyKey } from "@/_shared/idempotency";
