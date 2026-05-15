import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  AlertChip,
  Skel,
  VendorCard,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

interface FuelTypeRow {
  _id: string;
  name: string;
  unit: string;
}

/**
 * Add station — minimal form to get a station rolling. Vendor edits
 * the rest (hours, payment methods, full pricing) on the station-edit
 * screen once it's created.
 *
 * Required server fields: stationName, address, state, lga, fuels[].
 * We collect:
 *   name, address, state, lga
 *   one fuel × price as the starter fuels[] entry
 */
export default function AddStationScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [fuels, setFuels] = useState<FuelTypeRow[] | null>(null);
  const [fuelTypeId, setFuelTypeId] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<FuelTypeRow[] | { fuelTypes: FuelTypeRow[] }>(
          "/api/fuel-types",
          { timeoutMs: 8000 },
        );
        if (cancelled) return;
        const list = Array.isArray(res) ? res : (res?.fuelTypes ?? []);
        setFuels(list);
        if (list[0]) setFuelTypeId(list[0]._id);
      } catch {
        // empty list; UI shows error
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const priceNum = useMemo(() => {
    const n = parseFloat(price);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [price]);

  const canSubmit =
    name.trim().length > 1 &&
    address.trim().length > 2 &&
    state.trim().length > 1 &&
    lga.trim().length > 1 &&
    fuelTypeId &&
    priceNum > 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await api.post<{ stationId: string }>(
        "/api/vendor/stations",
        {
          stationName: name.trim(),
          address: address.trim(),
          state: state.trim(),
          lga: lga.trim(),
          location: { lat: 0, lng: 0 },
          fuels: [
            {
              fuel: fuelTypeId,
              pricePerUnit: priceNum,
              available: true,
            },
          ],
        },
      );
      toast.success("Station created");
      router.replace(
        `/(vendor)/(profile)/station/${res.stationId}` as never,
      );
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't create station");
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    name,
    address,
    state,
    lga,
    fuelTypeId,
    priceNum,
    router,
  ]);

  return (
    <VendorScreenShell title="Add station">
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={6}
          style={({ pressed }) => [
            styles.backRow,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="chevron-back" size={18} color={theme.fgMuted} />
          <Text style={styles.backText}>Back to stations</Text>
        </Pressable>

        <VendorCard>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Gaznger Apapa Depot"
            placeholderTextColor={theme.fgMuted}
            value={name}
            onChangeText={setName}
            accessibilityLabel="Station name"
          />

          <Text style={[styles.label, { marginTop: 14 }]}>Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Street + area"
            placeholderTextColor={theme.fgMuted}
            value={address}
            onChangeText={setAddress}
            accessibilityLabel="Address"
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { marginTop: 14 }]}>State</Text>
              <TextInput
                style={styles.input}
                placeholder="Lagos"
                placeholderTextColor={theme.fgMuted}
                value={state}
                onChangeText={setState}
                accessibilityLabel="State"
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { marginTop: 14 }]}>LGA</Text>
              <TextInput
                style={styles.input}
                placeholder="Apapa"
                placeholderTextColor={theme.fgMuted}
                value={lga}
                onChangeText={setLga}
                accessibilityLabel="LGA"
              />
            </View>
          </View>
        </VendorCard>

        <VendorCard>
          <Text style={styles.label}>First fuel + price</Text>
          {fuels == null ? (
            <Skel height={48} radius={12} />
          ) : (
            <View style={styles.fuelRow}>
              {fuels.map((f) => {
                const active = f._id === fuelTypeId;
                return (
                  <Pressable
                    key={f._id}
                    onPress={() => setFuelTypeId(f._id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    hitSlop={4}
                    style={({ pressed }) => [
                      styles.fuelChip,
                      active && styles.fuelChipActive,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.fuelChipText,
                        active && styles.fuelChipTextActive,
                      ]}
                    >
                      {f.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={[styles.label, { marginTop: 14 }]}>
            Price per unit (₦)
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 1100"
            placeholderTextColor={theme.fgMuted}
            keyboardType="numeric"
            value={price}
            onChangeText={setPrice}
            accessibilityLabel="Price per unit"
          />
        </VendorCard>

        <AlertChip
          tone="info"
          icon="information-circle"
          title="Add more fuels later"
          sub="Once the station's created, head to its edit screen for pricing, hours, and payment methods."
        />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
          accessibilityRole="button"
          accessibilityLabel="Create station"
          style={({ pressed }) => [
            styles.primaryBtn,
            (!canSubmit || submitting) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.primaryBtnText}>
            {submitting ? "Creating…" : "Create station"}
          </Text>
        </Pressable>
      </View>
    </VendorScreenShell>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    scroll: {
      padding: 20,
      gap: 14,
      paddingBottom: 110,
    },
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: -4,
    },
    backText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "600",
    },
    label: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: 6,
    },
    input: {
      ...theme.type.body,
      color: theme.fg,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: theme.surface,
    },
    row: {
      flexDirection: "row",
    },
    fuelRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    fuelChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.bgMuted,
      borderWidth: 1,
      borderColor: theme.border,
    },
    fuelChipActive: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
    },
    fuelChipText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "700",
    },
    fuelChipTextActive: {
      color: theme.primary,
    },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 24,
      backgroundColor: theme.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    primaryBtn: {
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryBtnText: {
      ...theme.type.body,
      color: theme.fgOnPrimary,
      fontWeight: "800",
    },
  });
