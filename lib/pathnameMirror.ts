/**
 * Module-level mirror of the current Expo Router pathname.
 *
 * Updated by <PathnameTracker /> mounted inside RootChildren (see
 * app/_layout.tsx). Read by any code path that needs the current
 * route WITHOUT subscribing to it — which prevents pathname-induced
 * re-renders at the root layout level, which would otherwise tear
 * down the entire <Stack> tree on every navigation (the post-OTP
 * blank-screen bug).
 *
 * Always exists; defaults to "" before the first mount.
 */
let _pathname = "";

export function setCurrentPathname(p: string) {
  _pathname = p;
}

export function getCurrentPathname(): string {
  return _pathname;
}
