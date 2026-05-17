import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import { AuthScreenContainer, V7Field } from "@/components/ui/auth";
import {
  AddressSheet,
  type AddressResult,
  type AddressSheetRef,
  Button,
} from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { useSessionStore } from "@/store/useSessionStore";

/**
 * Customer onboarding — v7 unified auth.
 *
 * Single-page form (not a multi-step wizard) per the v7 spec: display
 * name + email + delivery address. All three required. Address is
 * captured via the universal AddressSheet (Places autocomplete + map
 * drop-pin) so the customer's first order has a pre-filled destination.
 *
 * After Finish:
 *   PUT  /auth/me          { displayName, email }
 *   POST /api/address-book { label, street, city, state, latitude, longitude }
 *   → /(customer)/(home)
 */
export default function CustomerDetailsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const updateUser = useSessionStore((s) => s.updateUser);
  const sheetRef = useRef<AddressSheetRef>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState<AddressResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nameValid = name.trim().length >= 2;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const addressValid = !!address;
  const canSubmit = nameValid && emailValid && addressValid && !submitting;

  const openAddressPicker = useCallback(() => {
    sheetRef.current?.open();
  }, []);

  const handleAddressConfirm = useCallback((result: AddressResult) => {
    setAddress(result);
  }, []);

  const handleFinish = useCallback(async () => {
    if (!canSubmit || !address) return;
    setSubmitting(true);
    try {
      const profile = await api.put<{
        displayName?: string;
        email?: string;
      }>("/auth/me", {
        displayName: name.trim(),
        email: email.trim(),
      });
      updateUser({
        displayName: profile.displayName,
        email: profile.email,
      });

      await api.post("/api/address-book", {
        label: "Home",
        street: address.address,
        city: address.lga,
        state: address.stateLabel || address.state,
        latitude: address.latitude,
        longitude: address.longitude,
      });

      router.replace("/(customer)/(home)" as never);
    } catch (err: any) {
      toast.error("Couldn't finish setup", {
        description: err?.message ?? "Try again in a moment.",
      });
      setSubmitting(false);
    }
  }, [canSubmit, address, name, email, updateUser, router]);

  return (
    <AuthScreenContainer
      contentStyle={{ paddingTop: 0, paddingHorizontal: 0 }}
      background={theme.bgMuted}
      scrollable={false}
      footer={
        <Button
          variant="primary"
          size="lg"
          full
          onPress={handleFinish}
          loading={submitting}
          disabled={!canSubmit}
          accessibilityLabel="Finish setup"
        >
          {submitting ? "Saving…" : "Finish"}
        </Button>
      }
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>Almost there</Text>
          <Text style={styles.title}>A few quick details</Text>
          <Text style={styles.sub}>
            So we know who you are and where to bring your fuel.
          </Text>
        </View>

        <View style={styles.fields}>
          <V7Field
            label="Display name"
            required
            hint="Shown to your rider when you order."
            value={name}
            onChangeText={setName}
            placeholder="e.g. Ada Eze"
            autoCapitalize="words"
          />

          <V7Field
            label="Email"
            required
            hint="Receipts and important account updates."
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Address picker — tappable trigger styled like V7Field */}
          <View>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Delivery address</Text>
              <Text style={styles.requiredMark}> ·</Text>
            </View>
            <Pressable
              onPress={openAddressPicker}
              accessibilityRole="button"
              accessibilityLabel={
                address
                  ? `Delivery address: ${address.address}. Tap to change.`
                  : "Pick delivery address"
              }
              style={({ pressed }) => [
                styles.addressField,
                address ? styles.addressFieldFilled : null,
                pressed && { opacity: 0.94 },
              ]}
            >
              <Ionicons
                name="location"
                size={18}
                color={address ? theme.primary : theme.fgMuted}
              />
              <Text
                style={[
                  styles.addressText,
                  !address && { color: theme.fgMuted },
                ]}
                numberOfLines={1}
              >
                {address ? address.address : "Type to search Google Places"}
              </Text>
              <Ionicons
                name={address ? "create-outline" : "chevron-forward"}
                size={18}
                color={theme.fgMuted}
              />
            </Pressable>
            {!address ? (
              <Text style={styles.fieldHint}>
                We'll save this as your default — you can add more later.
              </Text>
            ) : null}
          </View>

          {/* "Home" preview card once address is locked in */}
          {address ? (
            <View style={styles.homePreviewCard}>
              <View style={styles.homePill}>
                <Text style={styles.homePillText}>Home</Text>
              </View>
              <Text style={styles.homePreviewText} numberOfLines={2}>
                Saved as your default address. You can add Office, Mum's
                place, etc. later.
              </Text>
            </View>
          ) : null}

          <View style={styles.infoNote}>
            <Ionicons
              name="information-circle"
              size={18}
              color={theme.info}
            />
            <Text style={styles.infoText}>
              Your phone is the only required login. Name, email, and
              address can be edited from Settings.
            </Text>
          </View>
        </View>
      </ScrollView>

      <AddressSheet ref={sheetRef} onConfirm={handleAddressConfirm} />
    </AuthScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 140,
    },
    headerBlock: {
      paddingHorizontal: 4,
      paddingTop: 8,
      paddingBottom: 16,
      gap: 6,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: theme.palette.green700,
    },
    title: {
      ...theme.type.h1,
      color: theme.fg,
      fontWeight: "800",
      letterSpacing: -0.3,
      fontSize: 22,
      marginTop: 4,
    },
    sub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      lineHeight: 20,
      marginTop: 4,
    },
    fields: {
      gap: 12,
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
      marginHorizontal: 2,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: theme.fgMuted,
    },
    requiredMark: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.palette.green700,
    },
    addressField: {
      height: 52,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1.5,
      borderColor: theme.divider,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    addressFieldFilled: {
      borderColor: theme.primary,
    },
    addressText: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: theme.fg,
    },
    fieldHint: {
      marginTop: 6,
      fontSize: 11.5,
      color: theme.fgMuted,
      marginHorizontal: 2,
    },
    homePreviewCard: {
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.palette.green50,
      borderWidth: 1,
      borderColor: theme.palette.green100,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    homePill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: theme.surface,
    },
    homePillText: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.palette.green700,
    },
    homePreviewText: {
      flex: 1,
      fontSize: 12.5,
      color: theme.palette.green700,
      lineHeight: 18,
    },
    infoNote: {
      marginTop: 6,
      padding: 14,
      borderRadius: 14,
      backgroundColor: theme.infoTint,
      borderWidth: 1,
      borderColor: theme.info + "33",
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
    },
    infoText: {
      flex: 1,
      ...theme.type.bodySm,
      color: theme.info,
      lineHeight: 20,
    },
  });
