# Gaznger — Mobile App

> **Version 2.0** | React Native (Expo) multi-role app for the Gaznger on-demand fuel delivery platform.

One app, four roles. Customers order fuel, vendors manage their stations and inventory, riders handle deliveries, and admins oversee the platform. Role-based routing serves each user the correct interface on login.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Screens & Navigation](#screens--navigation)
- [State Management](#state-management)
- [Theme System](#theme-system)
- [API Client](#api-client)
- [Features by Role](#features-by-role)
- [Setup & Running](#setup--running)
- [Environment Variables](#environment-variables)
- [Key Patterns & Conventions](#key-patterns--conventions)
- [Known Limitations & TODO](#known-limitations--todo)

---

## Tech Stack

| Concern | Library / Tool | Version |
|---------|---------------|---------|
| Framework | Expo | ~54.0 |
| Runtime | React Native | 0.81.5 |
| Language | TypeScript | ~5.9 |
| Navigation | Expo Router (file-based) | ~6.0 |
| State Management | Zustand | ^5.0 |
| Secure Storage | expo-secure-store | ~15.0 |
| Async Storage | @react-native-async-storage/async-storage | — |
| HTTP Client | `lib/api.ts` (fetch + JWT + mutex) | — |
| Maps | react-native-maps (Google) | 1.20.1 |
| Place Search | react-native-google-places-autocomplete | ^2.6 |
| Animations | react-native-reanimated | ~4.1 |
| Bottom Sheets | react-native-modalize | ^2.1 |
| Location | expo-location | ~18.0 |
| Image Picker | expo-image-picker + expo-image-manipulator | ~17.0 |
| Fonts | @expo-google-fonts/nunito | ^0.4 |
| Toasts | sonner-native | ^0.23 |

---

## Project Structure

```
mobile/gaznger/
├── app/
│   ├── _layout.tsx                    # Root: fonts, auth gate, Toaster, SafeAreaProvider
│   ├── index.tsx                      # Entry: hydrate session → role-based redirect
│   │
│   ├── (auth)/                        # Unauthenticated screens
│   │   ├── authentication.tsx         # Login / Sign Up with animated slide
│   │   ├── role-select.tsx            # Choose role: Customer / Vendor / Rider
│   │   ├── onboarding.tsx             # Customer first-time onboarding
│   │   ├── otp.tsx                    # 6-digit OTP entry
│   │   ├── forgot.tsx                 # Forgot password — email entry
│   │   ├── create.tsx                 # Set new password after OTP
│   │   └── modal/verified.tsx         # Post-verification success modal
│   │
│   ├── (customer)/                    # Customer role
│   │   ├── _layout.tsx                # Bottom tab bar (Home · Order · Track · Profile)
│   │   ├── (home)/index.tsx           # Fuel grid, points, promo, active order banner
│   │   ├── (order)/
│   │   │   ├── index.tsx              # Fuel + cylinder + quantity selection
│   │   │   ├── delivery.tsx           # Delivery address selection
│   │   │   ├── stations.tsx           # Station picker (map)
│   │   │   ├── payment.tsx            # Paystack WebView checkout (stub)
│   │   │   ├── receipt.tsx            # Order confirmation receipt
│   │   │   └── modal/
│   │   │       ├── order-summary.tsx  # Pre-payment summary + points redemption
│   │   │       └── rate-service.tsx   # Post-delivery star rating modal
│   │   └── (track)/index.tsx          # Live order tracking: map + progress stepper
│   │
│   ├── (vendor)/                      # Vendor role
│   │   ├── onboarding.tsx             # 3-step vendor setup wizard
│   │   └── (dashboard)/
│   │       ├── _layout.tsx            # Bottom tabs (Overview · Orders · Inventory · Earnings)
│   │       ├── index.tsx              # Station card, stats, fuel list
│   │       ├── orders.tsx             # Order queue with confirm/reject actions
│   │       ├── inventory.tsx          # Fuel price editing, availability, hours
│   │       └── earnings.tsx           # Earnings summary + paginated list
│   │
│   ├── (rider)/                       # Rider role
│   │   ├── onboarding.tsx             # 3-step rider setup wizard
│   │   └── (queue)/
│   │       ├── _layout.tsx            # Bottom tabs (Queue · History · Earnings)
│   │       ├── index.tsx              # Profile card, availability toggle, active delivery
│   │       ├── history.tsx            # Delivery history list
│   │       └── earnings.tsx           # Earnings summary + paginated list
│   │
│   ├── (screens)/                     # Shared secondary screens (all roles)
│   │   ├── profile.tsx                # Profile hub + menu grid
│   │   ├── personal-info.tsx          # Edit name and phone
│   │   ├── address-book.tsx           # Manage delivery addresses
│   │   ├── notification.tsx           # Notification centre (role-aware deep links)
│   │   ├── order-history.tsx          # Paginated order history + cancel
│   │   ├── payment-method.tsx         # Payment method info
│   │   ├── settings.tsx               # Appearance (Light/Auto/Dark) + notification toggles
│   │   ├── security-privacy.tsx       # Security & privacy
│   │   └── help-support.tsx           # Help & support
│   │
│   └── (legal)/
│       ├── privacy.tsx
│       └── terms.tsx
│
├── components/ui/
│   ├── auth/           # AuthToggle, LoginForm, SignupForm, OTPField, FormField
│   ├── global/         # BackButton, NotificationButton, CustomTabBar, ScreenBackground
│   ├── home/           # FuelGrid, HomeHeader, PointsBanner, ActiveOrderBanner,
│   │                   #   FuelPriceTicker, PromoBanner, RecentOrders, RedeemModal
│   ├── maps/           # StationsMap, StationsBottomSheet, StationDetailsModal,
│   │                   #   StationsFilter, StationListItem
│   ├── order/          # SelectService, QuantitySelect, CylinderTypeSelect,
│   │                   #   DeliveryTypeSelect, DeliveryLocationSelect, CylinderImageUpload
│   └── skeletons/      # Skeleton loaders for every major list and header
│
├── constants/
│   ├── theme.ts         # lightTheme · darkTheme · useTheme()
│   └── orderOptions.ts  # CYLINDER_TYPES · DELIVERY_TYPES · MIN_QUANTITY
│
├── store/
│   ├── useSessionStore.ts   # User session + tokens (expo-secure-store)
│   ├── useOrderStore.ts     # In-progress order form state (AsyncStorage)
│   ├── useThemeStore.ts     # Appearance override: "light"|"dark"|"system" (AsyncStorage)
│   ├── secureStorage.ts     # Zustand persist adapter for expo-secure-store
│   └── ZustandAsyncStorage.ts # Zustand persist adapter for AsyncStorage
│
├── hooks/
│   ├── useActiveOrder.ts    # Polls for active customer order every 30 s
│   └── useUserLocation.ts   # expo-location with permission handling
│
├── lib/
│   └── api.ts               # Fetch client: auth headers, 401 refresh + mutex
│
├── utils/
│   ├── mapBackendUser.ts    # Transform API user → app SessionUser shape
│   └── mask.ts              # maskEmail · maskPhone
│
├── types/
│   └── index.ts             # FuelType, Station, StationFuel shared interfaces
│
├── app.config.js            # Dynamic Expo config — injects GOOGLE_MAPS_API_KEY
└── tsconfig.json
```

---

## Screens & Navigation

### Auth Flow

```
app/index.tsx
  ├── not logged in     → /(auth)/authentication
  │                          ├── login tab   → role-based home on success
  │                          └── signup tab  → /(auth)/role-select
  │                                               → /(auth)/otp  → /(auth)/onboarding
  │                                                                       (customer only)
  └── logged in
        ├── customer    → /(customer)/(home)
        ├── vendor      → not onboarded → /(vendor)/onboarding
        │                 onboarded     → /(vendor)/(dashboard)
        ├── rider       → not onboarded → /(rider)/onboarding
        │                 onboarded     → /(rider)/(queue)
        └── admin       → /(customer)/(home)  (no dedicated admin screens yet)
```

### Customer Tabs

| Tab | Route | Description |
|-----|-------|-------------|
| Home | `/(customer)/(home)` | Fuel grid, loyalty banner, active order, recent orders |
| Order | `/(customer)/(order)` | Multi-step: fuel → address → station → payment → receipt |
| Track | `/(customer)/(track)` | Live tracking: map + animated 5-step progress stepper |
| Profile | `/(screens)/profile` | Profile hub, settings, logout |

### Order Flow Steps

1. Select fuel type, cylinder type, quantity, delivery type
2. Pick or add a delivery address (Google Places Autocomplete)
3. Choose a nearby station on the map
4. Review order summary + optionally redeem loyalty points
5. Paystack checkout (WebView — stub pending live key)
6. Confirmation receipt → redirect to home

### Vendor Tabs

| Tab | Route | Description |
|-----|-------|-------------|
| Overview | `/(vendor)/(dashboard)` | Station card with open/closed toggle, stats, fuel list |
| Orders | `/(vendor)/(dashboard)/orders` | Order queue with confirm/reject, status filter chips |
| Inventory | `/(vendor)/(dashboard)/inventory` | Inline price editing, per-fuel toggle, operating hours |
| Earnings | `/(vendor)/(dashboard)/earnings` | Pending/settled totals + paginated earnings list |

### Rider Tabs

| Tab | Route | Description |
|-----|-------|-------------|
| Queue | `/(rider)/(queue)` | Profile card, availability toggle, active delivery card |
| History | `/(rider)/(queue)/history` | Paginated delivery history |
| Earnings | `/(rider)/(queue)/earnings` | Pending/settled totals + paginated earnings |

The Queue screen polls GPS every 30 s and sends `PATCH /api/rider/location` while the rider is online or has an active delivery.

---

## State Management

### `useSessionStore` — expo-secure-store (encrypted keychain)

```ts
{
  user: SessionUser | null   // id, email, displayName, role, isOnboarded, points, …
  accessToken: string | null
  refreshToken: string | null
  isLoggedIn: boolean
  hasHydrated: boolean

  login(user, accessToken, refreshToken): void
  logout(): void
  updateUser(fields: Partial<SessionUser>): void
  setTokens({ accessToken, refreshToken }): void
}
```

### `useOrderStore` — AsyncStorage

Holds the in-progress order form across the multi-step flow:

```ts
{
  fuelTypes: FuelType[]
  order: { fuelId, fuel, quantity, cylinderType, deliveryType, cylinderImages,
           deliveryAddressId, stationId, station }
  progressStep: 0 | 1 | 2

  fetchFuelTypes(): Promise<void>
  setFuel(fuel): void
  setQuantity(n): void
  setDeliveryAddress(id): void
  setStation(station): void
  resetOrder(): void
  canContinue(): boolean
}
```

### `useThemeStore` — AsyncStorage

```ts
{
  colorScheme: "light" | "dark" | "system"   // default: "system"
  setColorScheme(scheme): void
}
```

---

## Theme System

`constants/theme.ts` exports `lightTheme`, `darkTheme`, and `useTheme()`.

`useTheme()` reads the override from `useThemeStore` first:
- If `"light"` → always light theme
- If `"dark"` → always dark theme
- If `"system"` → follows device `useColorScheme()`

The Settings screen exposes a three-segment toggle (Light / Auto / Dark) that writes to `useThemeStore`. The preference persists across app restarts.

All components consume `theme.*` tokens — no hardcoded hex values outside `constants/theme.ts`.

```ts
const theme = useTheme();
// theme.background · theme.surface · theme.text · theme.textSecondary
// theme.primary · theme.secondary · theme.accent · theme.error
// theme.ash · theme.icon · theme.tab · theme.skeleton
```

---

## API Client

All calls go through `lib/api.ts`:

- **`Authorization: Bearer`** header auto-injected from `useSessionStore`
- **Single-flight mutex** — one `POST /auth/refresh-token` in flight at a time; concurrent 401s queue behind it
- **Automatic retry** — original request retried once after successful refresh
- **204 handling** — returns `undefined` for No Content responses
- **Typed error unpacking** — throws with `errors[]` joined or `message` from response body

```ts
import { api } from "@/lib/api";

await api.get<Order[]>("/api/orders");
await api.post<Order>("/api/orders", { fuelId, stationId, quantity, deliveryAddressId });
await api.patch(`/api/rider/deliveries/${id}/accept`);
await api.delete(`/api/notifications/${id}`);
```

> For `multipart/form-data` uploads (profile photo, cylinder images) use raw `fetch` with the `Authorization` header taken from `useSessionStore.getState().accessToken`.

---

## Features by Role

### Customer
- [x] Email + OTP registration with role selection
- [x] Multi-step guided order flow with delivery fee preview
- [x] Station picker on Google Maps
- [x] Google Places Autocomplete for address input
- [x] Cylinder image upload (Cloudinary)
- [x] Order tracking: 5-step stepper (Pending → Confirmed → Assigned → In Transit → Delivered)
- [x] Post-delivery star rating modal
- [x] Loyalty points: earn, redeem as discount, full history
- [x] Active order banner + cross-tab navigation lock
- [x] Address book, order history, profile photo upload
- [x] Push notifications with role-aware deep linking

### Vendor
- [x] 3-step onboarding wizard
- [x] Station open/closed toggle
- [x] Order queue with confirm and reject actions
- [x] Inline fuel price editing and per-fuel availability toggle
- [x] Operating hours management
- [x] Earnings list: pending/settled totals
- [x] Push notification on new inbound orders

### Rider
- [x] 3-step onboarding wizard
- [x] Online/offline availability toggle
- [x] Active delivery card: Confirm Pickup → Mark as Delivered
- [x] GPS location polling (every 30 s while online or on delivery)
- [x] Delivery history list
- [x] Earnings list: pending/settled totals
- [x] Toast feedback on all delivery actions (sonner-native)
- [x] Push notification on dispatch

---

## Setup & Running

### Prerequisites
- Node.js 18+
- `expo-cli` (`npm install -g expo-cli`)
- Android Studio / Xcode for emulators, or Expo Go on a physical device

### Install & Start

```bash
cd mobile/gaznger
npm install
npx expo start
```

| Key | Action |
|-----|--------|
| `a` | Open Android emulator |
| `i` | Open iOS simulator |
| QR scan | Open in Expo Go (physical device) |

### Useful Commands

```bash
npx expo start --clear   # clear Metro bundler cache
npx tsc --noEmit         # TypeScript type check (no build)
npm run lint             # ESLint
```

### Pointing at the local backend from a physical device

Get your machine's LAN IP (`ipconfig` on Windows, `ifconfig` on macOS/Linux) then:

```env
EXPO_PUBLIC_BASE_URL=http://192.168.x.x:5000
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_BASE_URL` | Yes | Backend API base URL. LAN IP for local dev, production URL for builds. |
| `GOOGLE_MAPS_API_KEY` | Yes | Google Maps Platform key with Maps SDK and Places API enabled. Injected via `app.config.js`. |

---

## Key Patterns & Conventions

### Role-based routing
`app/index.tsx` reads `user.role` and `user.isOnboarded` from `useSessionStore` after hydration and navigates to the correct root for each role. New roles only need a new `case` in the router switch and a new directory under `app/`.

### Notification deep linking
`(screens)/notification.tsx` maps notification `type` → route per role:
- **customer** `order`/`delivery` → `/(customer)/(track)`
- **vendor** `new_order` → `/(vendor)/(dashboard)/orders`
- **rider** `dispatch` → `/(rider)/(queue)`
- **rider** `earnings` → `/(rider)/(queue)/earnings`

### Toast pattern
All user-facing feedback uses `sonner-native`:
```ts
import { toast } from "sonner-native";
toast.success("Pickup confirmed", { description: "Head to the delivery address." });
toast.error("Failed", { description: err.message });
```
`Alert.alert` is reserved for destructive confirmation dialogs only.

### Skeleton screens
Every major list and header has a matching skeleton component in `components/ui/skeletons/`. Screens show skeletons while `hasHydrated` is false or while the first fetch is in flight.

### Order store persistence
`useOrderStore` is persisted to AsyncStorage so an in-progress order survives a background kill. `resetOrder()` is called on receipt screen mount and on cancel.

---

## Known Limitations & TODO

- **Paystack WebView** — payment screen exists but is a stub; activate with a live Paystack key
- **Admin mobile screens** — no UI; admin users currently fall through to the customer home
- **Real-time rider tracking** — rider position on the customer track screen is simulated; full real-time needs WebSocket or SSE
- **Settings not persisted to backend** — notification preference toggles are UI-only
- **Vendor bank account schema** — stored on User document dynamically; not type-safe
- **FuelPlantOrder flow** — model exists on the server; no routes or screens built yet
- **No form validation library** — ad-hoc checks; replacing with Zod + React Hook Form is planned
- **No test coverage** — add React Native Testing Library + Jest

---

*Gaznger Mobile v2.0 — Expo · React Native · TypeScript · Zustand · Expo Router*
