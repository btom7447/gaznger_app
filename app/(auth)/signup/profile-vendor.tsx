import React, { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import { AuthScreenContainer } from "@/components/ui/auth";
import {
  AddressSheet,
  type AddressResult,
  type AddressSheetRef,
  Button,
  Chip,
  Input,
} from "@/components/ui/primitives";
import { NIGERIA_STATES } from "@/constants/nigeriaStates";
import { usePendingSignupStore } from "@/store/usePendingSignupStore";

const PRODUCTS = ["petrol", "diesel", "kerosene", "lpg"] as const;
const PRODUCT_LABELS: Record<(typeof PRODUCTS)[number], string> = {
  petrol: "Petrol",
  diesel: "Diesel",
  kerosene: "Kerosene",
  lpg: "LPG",
};

/**
 * Vendor profile setup. Step 2 (banking + payouts) is not in the
 * design bundle — see _drift/auth-vendor-profile-step-2.md. Until
 * that lands, vendor profile commits with the fields below and
 * routes straight to PIN create. The footer reads "Continue" only.
 *
 * NMDPRA licence number is captured exactly as printed on the
 * certificate; verification will run a background check on it.
 */
export default function ProfileVendorScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const stored = usePendingSignupStore((s) => s.profile.vendor);
  const phone = usePendingSignupStore((s) => s.phone);
  const patchProfile = usePendingSignupStore((s) => s.patchProfile);
  const setLastStep = usePendingSignupStore((s) => s.setLastStep);

  const [stationName, setStationName] = useState(stored?.stationName ?? "");
  const [licence, setLicence] = useState(stored?.licence ?? "");
  // "No licence yet" → submit with no licence string. Server accepts
  // null and the account stays in `verificationStatus: "pending"` until
  // the operator either uploads a real licence or admin flags it as
  // unverified. We rehydrate this from prior sessions by checking
  // whether the stored licence is empty.
  const [noLicenceYet, setNoLicenceYet] = useState(
    !stored?.licence && stored?.licence !== undefined
      ? true
      : Boolean(stored?.licence === "" && stored !== undefined)
  );
  const [contact, setContact] = useState(stored?.contact ?? phone ?? "");
  // Address is now collected via the VendorAddressSheet — we hold the
  // composed address string + canonical state code + lat/lng + lga
  // here so the form has everything it needs to ship to the server.
  const [address, setAddress] = useState(stored?.address ?? "");
  const [stateCode, setStateCode] = useState(stored?.state ?? "");
  const [lga, setLga] = useState(stored?.lga ?? "");
  const [latitude, setLatitude] = useState<number | null>(
    stored?.latitude ?? null
  );
  const [longitude, setLongitude] = useState<number | null>(
    stored?.longitude ?? null
  );
  const [products, setProducts] = useState<string[]>(stored?.products ?? []);
  const addressSheetRef = useRef<AddressSheetRef>(null);

  // Display label for the address-button. We fall back to the state
  // label when the user hasn't typed a street yet so the button isn't
  // ever empty if a coord exists.
  const stateLabel = useMemo(
    () => NIGERIA_STATES.find((s) => s.code === stateCode)?.label ?? "",
    [stateCode]
  );

  const valid =
    stationName.trim().length >= 3 &&
    (noLicenceYet || licence.trim().length >= 6) &&
    contact.trim().length >= 8 &&
    address.trim().length >= 6 &&
    latitude != null &&
    longitude != null &&
    stateCode.length > 0 &&
    products.length > 0;

  const handleAddressConfirm = useCallback((result: AddressResult) => {
    setAddress(result.address);
    setStateCode(result.state);
    setLga(result.lga);
    setLatitude(result.latitude);
    setLongitude(result.longitude);
  }, []);

  const toggleProduct = (p: string) => {
    setProducts((current) =>
      current.includes(p) ? current.filter((x) => x !== p) : [...current, p]
    );
  };

  const handleContinue = useCallback(() => {
    if (!valid || latitude == null || longitude == null) return;
    patchProfile("vendor", {
      stationName: stationName.trim(),
      // No-licence submissions persist as undefined so the server
      // signup payload omits the field entirely. Vendor still gets
      // verificationStatus=pending and stays unverified until they
      // upload a real licence later (verification kickoff flow).
      licence: noLicenceYet ? undefined : licence.trim(),
      contact: contact.trim(),
      address: address.trim(),
      state: stateCode,
      lga: lga.trim(),
      latitude,
      longitude,
      products,
    });
    setLastStep("/(auth)/signup/pin-create");
    router.push("/(auth)/signup/pin-create" as never);
  }, [
    valid,
    stationName,
    noLicenceYet,
    licence,
    contact,
    address,
    stateCode,
    lga,
    latitude,
    longitude,
    products,
    patchProfile,
    setLastStep,
    router,
  ]);

  return (
    <AuthScreenContainer
      contentStyle={{ paddingTop: theme.space.s4, gap: theme.space.s4 }}
      footer={
        <Button
          variant="primary"
          size="lg"
          full
          onPress={handleContinue}
          disabled={!valid}
          accessibilityLabel="Continue to PIN setup"
        >
          Continue
        </Button>
      }
    >
      <View style={styles.headerWrap}>
        <Text style={styles.title}>Station details</Text>
        <Text style={styles.sub}>Basic information.</Text>
      </View>

      <Input
        label="STATION NAME"
        value={stationName}
        onChangeText={setStationName}
        placeholder="e.g. TotalEnergies Lekki"
        autoCapitalize="words"
      />
      <View style={{ gap: theme.space.s2 + 2 }}>
        <Input
          label="NMDPRA LICENCE NUMBER"
          value={licence}
          onChangeText={setLicence}
          placeholder="e.g. NMD/OP/2024/…"
          autoCapitalize="characters"
          editable={!noLicenceYet}
          helper={
            noLicenceYet
              ? "You'll be marked unverified until a licence is uploaded."
              : "Exactly as shown on the licence certificate."
          }
        />
        <Pressable
          onPress={() => setNoLicenceYet((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: noLicenceYet }}
          accessibilityLabel="I don't have a licence yet"
          style={({ pressed }) => [
            styles.toggleRow,
            pressed && { opacity: 0.85 },
          ]}
          hitSlop={6}
        >
          <View
            style={[
              styles.toggleBox,
              noLicenceYet && styles.toggleBoxChecked,
            ]}
          >
            {noLicenceYet ? (
              <Ionicons name="checkmark" size={14} color={theme.fgOnPrimary} />
            ) : null}
          </View>
          <Text style={styles.toggleText}>I don't have a licence yet</Text>
        </Pressable>
      </View>
      <Input
        label="CONTACT NUMBER"
        value={contact}
        onChangeText={setContact}
        placeholder="+234…"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />
      <View>
        <Text style={styles.eyebrow}>STATION ADDRESS</Text>
        <Pressable
          onPress={() =>
            addressSheetRef.current?.open({
              address,
              state: stateCode,
              lga,
              latitude: latitude ?? undefined,
              longitude: longitude ?? undefined,
            })
          }
          accessibilityRole="button"
          accessibilityLabel={
            address
              ? `Edit station address: ${address}`
              : "Set station address"
          }
          style={({ pressed }) => [
            styles.addressBtn,
            pressed && { opacity: 0.92 },
          ]}
        >
          <Ionicons
            name="location"
            size={18}
            color={address ? theme.primary : theme.fgMuted}
          />
          <View style={{ flex: 1 }}>
            {address ? (
              <>
                <Text style={styles.addressPrimary} numberOfLines={1}>
                  {address}
                </Text>
                <Text style={styles.addressSecondary} numberOfLines={1}>
                  {[lga, stateLabel].filter(Boolean).join(" · ") ||
                    "Tap to refine"}
                </Text>
              </>
            ) : (
              <Text style={styles.addressPlaceholder}>
                Search address + drop pin
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.fgMuted} />
        </Pressable>
      </View>

      <View>
        <Text style={styles.eyebrow}>PRODUCTS AVAILABLE</Text>
        <View style={styles.chipRow}>
          {PRODUCTS.map((p) => (
            <Chip
              key={p}
              kind="primary"
              selected={products.includes(p)}
              onPress={() => toggleProduct(p)}
              accessibilityLabel={PRODUCT_LABELS[p]}
            >
              {PRODUCT_LABELS[p]}
            </Chip>
          ))}
        </View>
      </View>

      <AddressSheet
        ref={addressSheetRef}
        onConfirm={handleAddressConfirm}
        copy={{
          title: "Station address",
          sub: "Search the address, then drag the pin if it isn't quite right.",
          searchPlaceholder: "Search address or landmark",
          confirmLabel: "Confirm address",
        }}
      />
    </AuthScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    headerWrap: {
      gap: theme.space.s2,
    },
    title: {
      fontSize: 26,
      lineHeight: 30,
      fontWeight: "800",
      letterSpacing: -0.6,
      color: theme.fg,
    },
    sub: {
      ...theme.type.body,
      color: theme.fgMuted,
    },
    eyebrow: {
      ...theme.type.micro,
      color: theme.fgMuted,
      marginBottom: 8,
    },
    /** Tappable address row — opens the VendorAddressSheet on press. */
    addressBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
      height: 56,
      paddingHorizontal: theme.space.s3 + 2,
      borderRadius: theme.radius.md + 2,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    addressPrimary: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    addressSecondary: {
      ...theme.type.caption,
      color: theme.fgMuted,
      marginTop: 2,
    },
    addressPlaceholder: {
      ...theme.type.body,
      color: theme.fgMuted,
    },
    /** Inline checkbox row beneath the licence field. */
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s2,
      paddingVertical: theme.space.s1,
    },
    toggleBox: {
      width: 20,
      height: 20,
      borderRadius: theme.radius.sm - 2,
      borderWidth: 1.5,
      borderColor: theme.borderStrong,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    toggleBoxChecked: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    toggleText: {
      ...theme.type.bodySm,
      color: theme.fg,
      fontWeight: "600",
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.s2,
    },
  });
