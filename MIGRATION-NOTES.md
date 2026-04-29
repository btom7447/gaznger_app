# Gaznger Mobile — Customer Revamp Migration Notes

Authored 2026-04-29, after the customer-flow revamp + Paystack/escrow
integration + the post-revamp cleanup pass.

This document captures the **discrete migrations** a developer needs to
remember when reading the code: legacy → new replacements, fields that
moved, hard-coded values that became server-driven, and dead code that
was retired.

---

## 1. Token migration (Phase 0)

`constants/theme.ts` swap to `02-tokens.ts`-shaped tokens. Legacy keys
preserved for back-compat.

| Legacy | New |
|---|---|
| `theme.aqua` | **removed** — replace any remaining reference with `theme.primary` or `theme.info` (none should exist after this pass) |
| `theme.secondary` (`#3A9E3A` / `#52C052`) | redirected to `theme.primary` family |
| flat `theme.background` / `theme.surface` | still present + new semantic group `bg`/`bgMuted`/`surface`/`surfaceElevated`/`surfaceSunken` |
| `theme.text` / `theme.icon` etc. | still present + new `fg`/`fgMuted`/`fgSubtle`/`fgOnPrimary`/`fgOnAccent` |
| `useThemeStore(s => s.themeOverride)` (spec hook) | now `useThemeStore(s => s.colorScheme)` to match the existing store shape |

`formatCurrency()` exported from `constants/theme.ts` is the **only**
place naira amounts get formatted. AC sweep across `app/(customer)`
returns 0 hits for raw `'₦'` outside this helper.

---

## 2. Order draft store (`useOrderStore`) — schema v2

`OrderDraft` extended with the new flow fields. Persisted at version `2`
with a hard-cutover migrator that drops anything older. 24h-expiry on
drafts means there are no in-flight legacy drafts to migrate.

**New fields:**

- `product: "liquid" | "lpg"` — drives the unified Order screen branch
- `fuelTypeId: string` — slug ("petrol"/"diesel"/"kero"/"lpg") sent on
  `POST /api/orders` instead of the legacy ObjectId `fuelId`. Server
  resolves either.
- `unit: "L" | "kg"`, `qty: number` (mirrors legacy `quantity`)
- `serviceType: "refill" | "swap"` (LPG only, replaces legacy
  `deliveryType` at the customer-facing layer)
- `when: "now" | "schedule"`, `scheduledAt: string | null`
- `returnSwapAt: string | null` — LPG-Swap return-trip ISO. Server
  exposes the same field on the order document.
- `note: string` — rider note (Delivery + Schedule both write here;
  Schedule's content gets merged with `\n— Cylinder: ` separator)
- `cylinderPhotos: string[]` — Cloudinary URLs (mirrors legacy
  `cylinderImages`)
- `cylinderDetails: { brand, valve, age, test }` — LPG-Swap only,
  captured on the Cylinder screen
- `station: LockedStation` — `{ id, name, perUnitKobo, totalKobo,
  distMeters, etaMinutes, partnerVerified, lockedAt }` — populated on
  the Stations screen
- `paymentMethodId`, `orderId`
- **Post-payment fields** (populated by socket events from server):
  - `rider` — `{ firstName, lastName, plate, rating, phone, initials }`
  - `deliveredAt`, `totalCharged`, `pointsEarned`
  - `weighIn` — LPG-Swap weight verification from rider app
  - `rating` — customer's submitted rating (lifted to store so Complete
    can render it)

**Legacy fields kept as mirrors** so transitional screens still
compile: `fuel`, `quantity`, `cylinderImages`, `cylinderType`,
`deliveryType`, `stationId`, `stationLabel`. Mirrors are written by
the new setters automatically — never written directly by new code.

---

## 3. Hard-coded values → server-driven

| Was hard-coded | Now reads |
|---|---|
| `methodSubLabel = "GTB •••• 4892"` (Receipt) | `paymentMethodLabel(draft.paymentMethodId, user)` resolving against `lastPaystackAuth` |
| `+500` flat delivery added on Delivered/Complete | `draft.totalCharged` from delivery-confirm payload |
| `9:54am` literal across Delivered/Complete | `draft.deliveredAt` formatted in en-NG |
| `POINTS_EARNED_DEMO = 125` | `draft.pointsEarned` (server emits on confirm) |
| `"Emeka Okafor / LSR-238-AY / ★ 4.9 / +234801…"` everywhere | `draft.rider` (populated by `order:update` socket on `assigned`) |
| `"You rated Emeka 5 stars and tipped ₦500"` static body on Complete | Composed from `draft.rating` + `draft.pointsEarned` |
| Hard-coded `Empty: 14.2kg / Full: 26.7kg / 12.5kg gas` on Handoff | `draft.weighIn` from rider app `order:update` payload (card hides until present) |
| Stations ETA computed client-side as `distance × 3` | Server returns canonical `etaMinutes` on each station; client falls back to old heuristic only when missing |
| Track `riderCoord = lat - 0.01, lng - 0.01` placeholder | Real coords from `socket.on("rider:location")`; map shows no rider pin until first push |
| Track straight-line `<Polyline>` between rider + destination | Server-side proxy `GET /api/orders/:id/route?riderLat=&riderLng=` returns Google Directions polyline (30s cache) |
| `LiveBadge` offline kind = `"neutral"` (grey) | `"error"` (red) — visible from across the room |
| Track X close button | Replaced with `chevron-down` minimize that snaps the sheet to its lowest position |
| Receipt PDF `Share.share(...)` text | Same — real PDF generation deferred |
| Arrival dispense ring filled = 0 (no socket subscription) | `socket.on("dispense:progress", { litres })` |
| Saved-cylinder card always hidden (`hasSavedCylinder = false`) | Real `user.lpgOrderCount + savedCylinder` from `/auth/me` |
| Photo screen uploaded local URIs as-is | Cloudinary upload via `POST /api/upload/image` before Continue; `setCylinderPhotos` writes the secure URLs |

---

## 4. Server contract additions

Server PRs that landed alongside the mobile revamp:

- `Order.note`, `Order.returnSwapAt`, `Order.deliveredAt`, `Order.totalCharged`,
  `Order.weighIn`, `Order.pointsEarned`, `Order.rating`, `Order.cylinderDetails`
- `User.lastPaystackAuth`, `User.savedCylinder`, `User.accountStatus`,
  `User.withdrawalHold`
- `POST /api/orders` accepts both `fuelId` (legacy ObjectId) and
  `fuelTypeId` (slug)
- `POST /api/orders/:id/rate` extended to accept `stars + tags + tip + note`
  (legacy `score + comment` still works)
- `GET /api/orders/:id` populates `riderId` (with `displayName`, `phone`,
  `profileImage`) + side-loads `riderProfile` (`plate`, `rating`)
- `GET /api/orders/:id/route?riderLat=&riderLng=` — Directions polyline
- `GET /api/stations` returns `distance` + `etaMinutes` when caller
  passes `lat`+`lng`
- `GET /auth/me` returns `lpgOrderCount`
- Customer-confirm-delivery emits `{ deliveredAt, totalCharged, pointsEarned }`
  on `order:update`
- Rider-accept-delivery emits the rider's customer-safe fields on
  `order:update`

---

## 5. Files retired

- `app/(customer)/(history)/_layout.tsx`, `app/(customer)/(history)/index.tsx`
  — orphan route group, never reachable. Home + Profile both link to
  `/(screens)/order-history` which is the canonical history screen.
- `app/(customer)/(order)/modal/order-summary.tsx` — pre-revamp legacy
  modal, not referenced from any new flow.
- `app/(customer)/(order)/modal/rate-service.tsx` — replaced by
  `(customer)/(track)/rate.tsx`.
- The `(customer)/(order)/modal/` folder is gone entirely.

---

## 6. Track screen redesign (special call-out)

Track was rebuilt in this pass to handle four explicit phases:

1. **`matching`** — server hasn't assigned a rider yet. Sheet shows
   pulsing avatar placeholder + "Matching you to the closest rider".
   No ETA, no checklist.
2. **`assigned`** / **`in_transit`** — rider populated via
   `order:update`. Shows ETA, 4-step checklist, rider card with
   `call` + `chat` actions (chat is a stub route).
3. **`arrived`** — auto-routes to Arrival (liquid) or Handoff (LPG).

Map polyline now follows real road geometry via the server proxy. The
client refetches every 60s rather than on every `rider:location` push
(rider marker animates between fetches; refetching the whole road on
every push wastes Directions API quota).

`LiveBadge` shows `LIVE` / `RECONNECTING` / `OFFLINE` driven by socket
status. `OfflineStrip` slides in across the top of the screen on
NetInfo offline > 1s.

X close button replaced with `chevron-down` minimize. Tapping it
snaps the sheet to its lowest snap point (18%) so the user can see
the map without leaving the screen.

---

## 7. Wallet IA

`(customer)/wallet/{index,topup}.tsx` were unreachable post-Paystack
integration. New entry points:

- **Profile menu**: `Wallet` row added between Settings and Payment
  Method, points at `/(customer)/wallet`.
- **Payment screen**: `<PaymentMethodList onTopUp>` renders an inline
  "Top up" pill on the wallet method when `insufficient`. Tapping it
  pushes `/(customer)/wallet/topup` modally without leaving the
  payment flow.

---

## 8. Open follow-ups (intentionally deferred)

- Rider tip transfer — `/api/orders/:id/rate` captures the tip but
  the wallet→rider transfer isn't wired yet (TODO in the route handler).
- Receipt PDF generation — `Share.share` text only.
- Real `dispense:progress` event from rider app — client subscribes,
  but rider app emit is its own task.
- LPG vendor pricing per-station — the matcher in `stations.tsx` now
  recognises LPG, but seed data needs LPG entries on each station's
  `fuels[]` for the screen to render anything.
- `(history)/` screen rebuild — for now `/(screens)/order-history` is
  canonical; redesign pass deferred.
