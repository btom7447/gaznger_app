/**
 * SECURITY N1 (Phase 1 scaffolding) — SSL/cert-pinning wrapper.
 *
 * Today: passthrough to global `fetch`. The wrapper exists so
 * Phase 4 can swap in `react-native-ssl-pinning` without churning
 * every call site in `lib/api.ts`. Phase 4 bundles the native rebuild
 * (alongside the `expo-screen-capture` add per SECURITY X1) so we
 * only prebuild once.
 *
 * Pinning policy (per decision D5):
 *   - Pin Let's Encrypt R3 (current) AND R10 (rotation backup)
 *   - Enforce ONLY in production builds (NODE_ENV === "production")
 *   - On dev / EAS preview / Expo Go: passthrough
 *   - On both-pins-fail: app shows "Update required" screen rather
 *     than silently bricking — Phase 4 wires the error toast +
 *     route
 *
 * Public API matches global `fetch` so the call site is identical.
 */
export const pinnedFetch: typeof fetch = (input, init) => {
  // Phase 4 will replace this body with the real pinned call:
  //
  //   import RNSslPinning from "react-native-ssl-pinning";
  //   if (process.env.NODE_ENV === "production" && Platform.OS !== "web") {
  //     return RNSslPinning.fetch(input.toString(), { ...init, sslPinning: { certs: ["letsencrypt-r3", "letsencrypt-r10"] }});
  //   }
  return fetch(input, init);
};
