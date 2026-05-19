/**
 * Dev-gated logging helpers.
 *
 * Replaces ungated `console.log` calls across the app so production
 * builds don't leak request URLs, lifecycle states, or bio-probe
 * outcomes to Logcat / Xcode Console / EAS Insights.
 *
 * Closes SECURITY X2 + X3 + EDGE P3-1.
 *
 * Use `devLog` / `devWarn` everywhere we used to use `console.log` /
 * `console.warn` for ephemeral debug output. Keep raw `console.error`
 * for true errors that should ALWAYS log (e.g. unhandled promise
 * rejections); raw errors are caught by Sentry/EAS in prod and that's
 * fine because we never log PII alongside them (verified by audit X4).
 */
const enabled = __DEV__;

export function devLog(...args: unknown[]): void {
  if (enabled) console.log(...args);
}

export function devWarn(...args: unknown[]): void {
  if (enabled) console.warn(...args);
}

export function devInfo(...args: unknown[]): void {
  if (enabled) console.info(...args);
}
