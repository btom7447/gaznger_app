import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import { AuthScreenContainer } from "@/components/ui/auth";
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
 * Single-page form: display name + email + delivery address. All three
 * required. The address is captured via the universal AddressSheet
 * (full picker with map drop-pin + state dropdown) so the customer's
 * first order has a pre-filled destination.
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
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>Almost there</Text>
          <Text style={styles.title}>A few quick details</Text>
          <Text style={styles.sub}>
            So we know who you are and where to bring your fuel.
          </Text>
        </View>

        <Field
          label="Display name"
          required
          hint="Shown to your rider when you order."
          value={name}
          onChangeText={setName}
          placeholder="e.g. Ada Eze"
          theme={theme}
          autoCapitalize="words"
        />

        <Field
          label="Email"
          required
          hint="Receipts and important account updates."
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          theme={theme}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Address picker — tap to open AddressSheet */}
        <Pressable
          onPress={openAddressPicker}
          accessibilityRole="button"
          accessibilityLabel={
            address
              ? `Delivery address: ${address.address}. Tap to change.`
              : "Pick delivery address"
          }
          style={({ pressed }) => [
            styles.addressBlock,
            address ? styles.addressBlockFilled : null,
            pressed && { opacity: 0.94 },
          ]}
        >
          <View style={styles.addressHeader}>
            <Text style={styles.fieldLabel}>
              Delivery address{" "}
              <Text style={{ color: theme.palette.green700 }}>·</Text>
            </Text>
          </View>
          <View style={styles.addressRow}>
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
              numberOfLines={2}
            >
              {address ? address.address : "Search & drop a pin"}
            </Text>
            <Ionicons
              name={address ? "create-outline" : "chevron-forward"}
              size={18}
              color={theme.fgMuted}
            />
          </View>
          {address ? (
            <View style={styles.addressMeta}>
              <Pill tone="primary" theme={theme}>
                Home
              </Pill>
              <Text style={styles.metaText} numberOfLines={1}>
                {address.lga ? `${address.lga}, ` : ""}
                {address.stateLabel || address.state}
              </Text>
            </View>
          ) : (
            <Text style={styles.fieldHint}>
              We'll save this as your default — you can add more later.
            </Text>
          )}
        </Pressable>

        <View style={styles.infoNote}>
          <Ionicons
            name="information-circle"
            size={18}
            color={theme.info}
          />
          <Text style={styles.infoText}>
            Your phone is the only required login. Name, email, and address
            can be edited from Settings.
          </Text>
        </View>
      </ScrollView>

      <AddressSheet ref={sheetRef} onConfirm={handleAddressConfirm} />
    </AuthScreenContainer>
  );
}

function Field({
  label,
  required,
  hint,
  value,
  onChangeText,
  placeholder,
  theme,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  theme: Theme;
  keyboardType?: "default" | "email-address" | "phone-pad" | "number-pad";
  autoCapitalize?: "none" | "words" | "sentences" | "characters";
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={fieldStyles(theme).label}>
        {label}
        {required ? (
          <Text style={{ color: theme.palette.green700 }}> ·</Text>
        ) : null}
      </Text>
      <View
        style={[
          fieldStyles(theme).field,
          focused && fieldStyles(theme).fieldFocused,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={theme.fgMuted}
          style={fieldStyles(theme).input}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCapitalize === "none" ? false : true}
        />
      </View>
      {hint ? <Text style={fieldStyles(theme).hint}>{hint}</Text> : null}
    </View>
  );
}

function Pill({
  tone,
  theme,
  children,
}: {
  tone: "primary";
  theme: Theme;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: theme.primaryTint,
      }}
    >
      <Text
        style={{
          color: theme.palette.green700,
          fontSize: 11,
          fontWeight: "800",
        }}
      >
        {children}
      </Text>
    </View>
  );
}

const fieldStyles = (theme: Theme) =>
  StyleSheet.create({
    label: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: theme.fgMuted,
      marginBottom: 6,
      marginHorizontal: 2,
    },
    field: {
      height: 52,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1.5,
      borderColor: theme.divider,
      flexDirection: "row",
      alignItems: "center",
    },
    fieldFocused: {
      borderColor: theme.primary,
    },
    input: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: theme.fg,
      paddingVertical: 0,
    },
    hint: {
      fontSize: 11.5,
      color: theme.fgMuted,
      marginTop: 6,
      marginHorizontal: 2,
    },
  });

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
      marginTop: 2,
    },
    sub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      lineHeight: 20,
      marginTop: 4,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: theme.fgMuted,
    },
    addressBlock: {
      marginTop: 12,
      padding: 14,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1.5,
      borderColor: theme.divider,
    },
    addressBlockFilled: {
      borderColor: theme.primary,
      backgroundColor: theme.primaryTint,
    },
    addressHeader: {
      marginBottom: 8,
    },
    addressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    addressText: {
      flex: 1,
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    addressMeta: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    metaText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      flex: 1,
    },
    fieldHint: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginTop: 8,
      marginLeft: 28,
    },
    infoNote: {
      marginTop: 20,
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
