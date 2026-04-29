import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";
import { useSessionStore } from "@/store/useSessionStore";
import { api } from "@/lib/api";
import {
  FloatingCTA,
  ProgressDots,
  RadioGroup,
  RadioOption,
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";
import AddressList, {
  AddressLite,
} from "@/components/ui/customer/order/AddressList";
import { useFlowProgress } from "@/components/ui/customer/order/useFlowProgress";
import ScheduleSheet, {
  ScheduleSheetRef,
} from "@/components/ui/customer/order/ScheduleSheet";

interface ServerAddress {
  _id: string;
  label: string;
  street?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
  icon?: string;
}

const NOTE_MAX = 80;

const ICON_FOR_LABEL: Record<
  string,
  React.ComponentProps<typeof Ionicons>["name"]
> = {
  home: "home-outline",
  office: "briefcase-outline",
  work: "briefcase-outline",
  other: "location-outline",
};

function adapt(a: ServerAddress): AddressLite {
  const line = [a.street, a.city].filter(Boolean).join(", ");
  const key = (a.label ?? "").toLowerCase();
  return {
    id: a._id,
    label: a.label,
    line: line || "Tap to refine",
    icon: ICON_FOR_LABEL[key] ?? "location-outline",
  };
}

export default function DeliveryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { step, total } = useFlowProgress("delivery");
  const draft = useOrderStore((s) => s.order);
  const setSelectedAddress = useOrderStore((s) => s.setSelectedAddress);
  const setWhen = useOrderStore((s) => s.setWhen);
  const setNote = useOrderStore((s) => s.setNote);
  const userDefaultAddressId = useSessionStore(
    (s) => s.user?.defaultAddress ?? null
  );

  const [addresses, setAddresses] = useState<AddressLite[]>([]);
  // Keep the raw records around so handleContinue can pull lat/lng.
  const [rawAddresses, setRawAddresses] = useState<ServerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  // "When" is local to this screen — never seeded from `draft.when`. Each
  // step in the flow is an independent decision (LPG-swap schedule.tsx
  // also has its own state). Default opens fresh on "now". Persisted to
  // the store only when the user advances via Continue.
  const [whenChoice, setWhenLocal] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [note, setNoteLocal] = useState<string>(draft.note ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(
    draft.deliveryAddressId ?? userDefaultAddressId ?? null
  );

  const fetchAddresses = useCallback(async () => {
    try {
      const data = await api.get<ServerAddress[]>("/api/address-book", {
        timeoutMs: 10000,
      });
      const adapted = data.map(adapt);
      setAddresses(adapted);
      setRawAddresses(data);
      // Hydrate selection if nothing chosen yet.
      if (!selectedId && adapted.length > 0) {
        const def = data.find((a) => a.isDefault) ?? data[0];
        setSelectedId(def._id);
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  useFocusEffect(
    useCallback(() => {
      // refresh when returning from address-book
      fetchAddresses();
    }, [fetchAddresses])
  );

  const selected = useMemo(
    () => addresses.find((a) => a.id === selectedId) ?? null,
    [addresses, selectedId]
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleAddNew = useCallback(() => {
    router.push("/(screens)/address-book" as never);
  }, [router]);

  const scheduleSheetRef = useRef<ScheduleSheetRef>(null);

  const handleScheduleTap = useCallback(() => {
    scheduleSheetRef.current?.open();
  }, []);

  const handleWhenChange = useCallback(
    (v: string) => {
      const next = v === "schedule" ? "schedule" : "now";
      setWhenLocal(next);
      if (next === "schedule") handleScheduleTap();
    },
    [handleScheduleTap]
  );

  const handleScheduleConfirmed = useCallback((iso: string) => {
    setWhenLocal("schedule");
    setScheduledAt(iso);
  }, []);

  const handleContinue = useCallback(() => {
    if (!selected) return;
    // Carry the address coords forward so the Stations screen has somewhere
    // to query against. Without these, /api/stations gets called with no
    // lat/lng and Stations falls into its empty state.
    const raw = rawAddresses.find((a) => a._id === selected.id);
    const coords =
      raw && raw.latitude != null && raw.longitude != null
        ? { lat: raw.latitude, lng: raw.longitude }
        : undefined;
    setSelectedAddress({ id: selected.id, label: selected.label, coords });
    setNote(note.trim());
    setWhen(whenChoice, scheduledAt);
    // LPG-Swap detours through `schedule` next so the user can decide
    // whether the rider should take the empty same-trip or come back later.
    // Liquid + LPG-Refill go straight to Stations.
    const isSwap = draft.product === "lpg" && draft.serviceType === "swap";
    router.push(
      isSwap
        ? ("/(customer)/(order)/schedule" as never)
        : ("/(customer)/(order)/stations" as never)
    );
  }, [
    selected,
    rawAddresses,
    setSelectedAddress,
    setNote,
    note,
    setWhen,
    whenChoice,
    scheduledAt,
    draft.product,
    draft.serviceType,
    router,
  ]);

  // CTA echo: address label (Home / Office / etc.) + when.
  const ctaSubtitle = selected
    ? `${selected.label} · ${whenChoice === "now" ? "now" : "scheduled"}`
    : undefined;

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      contentStyle={styles.scroll}
      header={<ScreenHeader title="Where & when" />}
      footer={
        <FloatingCTA
          label="Continue"
          subtitle={ctaSubtitle}
          disabled={!selected}
          onPress={handleContinue}
          floating={false}
          accessibilityHint={
            !selected ? "Add or select an address to continue." : undefined
          }
        />
      }
    >
      <View style={styles.body}>
        <ProgressDots step={step} total={total} variant="bars" />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SAVED ADDRESSES</Text>
          <AddressList
            addresses={addresses}
            selectedId={selectedId}
            onSelect={handleSelect}
            loading={loading}
          />
          <Pressable
            onPress={handleAddNew}
            accessibilityRole="button"
            accessibilityLabel="Add a new address"
            style={({ pressed }) => [
              styles.addNew,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="add" size={18} color={theme.primary} />
            <Text style={styles.addNewText}>Add a new address</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>WHEN</Text>
          <RadioGroup value={whenChoice} onChange={handleWhenChange}>
            <RadioOption
              value="now"
              label="Now"
              sublabel="Rider ~12 min away"
            />
            <RadioOption
              value="schedule"
              label="Schedule"
              sublabel={
                whenChoice === "schedule" && scheduledAt
                  ? new Date(scheduledAt).toLocaleString("en-NG", {
                      weekday: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "30 minutes headsup"
              }
              trailing="chevron"
            />
          </RadioGroup>
          {whenChoice === "schedule" ? (
            <Pressable
              onPress={handleScheduleTap}
              accessibilityRole="button"
              accessibilityLabel="Change scheduled time"
              hitSlop={6}
            >
              <Text style={styles.changeTimeLink}>Change time</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOTE FOR RIDER · OPTIONAL</Text>
          <View style={styles.noteWrap}>
            <TextInput
              value={note}
              onChangeText={(v) => setNoteLocal(v.slice(0, NOTE_MAX))}
              placeholder="Gate code, landmark, etc."
              placeholderTextColor={theme.fgSubtle}
              multiline
              maxLength={NOTE_MAX}
              accessibilityLabel="Note for rider"
              accessibilityHint={`Optional. Up to ${NOTE_MAX} characters.`}
              accessibilityValue={{ text: `${note.length} of ${NOTE_MAX} characters` }}
              style={styles.noteInput}
            />
            <Text style={styles.noteCounter}>
              {note.length}/{NOTE_MAX}
            </Text>
          </View>
        </View>
      </View>

      <ScheduleSheet
        ref={scheduleSheetRef}
        value={scheduledAt}
        onChange={handleScheduleConfirmed}
      />
    </ScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      paddingBottom: theme.space.s5,
    },
    body: {
      paddingHorizontal: theme.space.s4,
      gap: theme.space.s5,
      paddingTop: theme.space.s2,
    },
    section: { gap: theme.space.s3 },
    sectionLabel: {
      ...theme.type.micro,
      fontSize: 13,
      letterSpacing: 0.6,
      color: theme.fgMuted,
    },
    changeTimeLink: {
      ...theme.type.caption,
      color: theme.primary,
      fontWeight: "700",
      alignSelf: "flex-end",
    },
    addNew: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderColor: theme.borderStrong,
      borderWidth: 1,
      borderStyle: "dashed",
      borderRadius: theme.radius.lg,
      paddingVertical: theme.space.s3,
    },
    addNewText: {
      ...theme.type.body,
      color: theme.primary,
      fontWeight: "700",
    },
    noteWrap: {
      backgroundColor: theme.bgMuted,
      borderRadius: theme.radius.md,
      borderColor: theme.border,
      borderWidth: 1,
      paddingHorizontal: theme.space.s3,
      paddingVertical: theme.space.s2 + 2,
    },
    noteInput: {
      ...theme.type.body,
      color: theme.fg,
      minHeight: 64,
      textAlignVertical: "top",
      padding: 0,
    },
    noteCounter: {
      ...theme.type.caption,
      color: theme.fgSubtle,
      alignSelf: "flex-end",
      marginTop: 4,
    },
  });
