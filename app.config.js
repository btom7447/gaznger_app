import "dotenv/config";

// Maps keys (audit E.7).
//
// We intentionally split the Google Maps API key into two:
//
//  - GOOGLE_MAPS_API_KEY  → native-only. Injected into the iOS/Android
//    native config so MapKit / Maps SDK can render tiles. Restricted in
//    GCP to the iOS bundle ID + Android package + SHA-256.
//
//  - EXPO_PUBLIC_GOOGLE_PLACES_API_KEY → JS-readable, used by Places
//    autocomplete + Geocoding from the bundle. Restricted in GCP to
//    Places + Geocoding only and to the same bundle IDs/SHA-256.
//
// Previously a single key was both shipped to native AND echoed into
// `extra` where any JS could read it (and from there into a memory
// dump). Native key is no longer in extra; only Places autocomplete
// reads its dedicated EXPO_PUBLIC_ var.

export default ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    "expo-secure-store",
    "expo-web-browser",
    // expo-location's config plugin handles the iOS NSLocation* keys +
    // Android ACCESS_*_LOCATION manifest entries automatically. The
    // strings in app.json's infoPlist take precedence; this just
    // guarantees the keys are registered even if someone edits the
    // plist by hand.
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "Riders use background location while on an active delivery so customers can see live ETA. Location is never tracked outside of an order.",
        locationWhenInUsePermission:
          "Gaznger needs your location to match you with nearby stations, route riders to your address, and show you live delivery tracking.",
      },
    ],
  ],
  ios: {
    ...config.ios,
    config: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    },
  },
  android: {
    ...config.android,
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
  },
});
