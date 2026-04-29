import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";
import {
  FloatingCTA,
  ProgressDots,
  RadioGroup,
  RadioOption,
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";
import { useFlowProgress } from "@/components/ui/customer/order/useFlowProgress";
import ReturnSwapSheet, {
  ReturnSwapSheetRef,
} from "@/components/ui/customer/order/ReturnSwapSheet";

const NOTE_MAX = 120;

/**
 * LPG-Swap step 5 — schedule the RETURN trip.
 *
 * Reached AFTER Delivery, so we already know where + when the rider's first
 * visit happens. This screen asks: should the rider take the empty cylinder
 * in the same trip ("Now") or come back later for it ("Schedule")?
 *
 *   - Now (default)   → same-trip swap; rider takes the empty when delivering
 *   - Schedule        → rider returns at a chosen day + time
 *
 * The chosen ISO is stored as `returnSwapAt` (null = same-trip). Server
 * contract: backend exposes the same field on the order document so the
 * rider app can schedule a second visit when applicable.
 */
export default function ScheduleScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { step, total } = useFlowProgress("schedule");
  const draft = useOrderStore((s) => s.order);
  const setReturnSwapAt = useOrderStore((s) => s.setReturnSwapAt);
  const setNote = useOrderStore((s) => s.setNote);

  // Local state — never seeded from store. Default = same-trip ("now").
  // Persisted on Continue.
  const [whenChoice, setWhenLocal] = useState<"now" | "schedule">("now");
  const [returnAt, setReturnAt] = useState<string | null>(null);
  // Note here is specific to the cylinder handoff; Delivery's note is for
  // the rider finding the address. Both are saved on the order draft —
  // we'll merge them on Continue with a separator.
  const [note, setNoteLocal] = useState<string>("");

  const sheetRef = useRef<ReturnSwapSheetRef>(null);

  const handleWhenChange = useCallback((v: string) => {
    const next = v === "schedule" ? "schedule" : "now";
    setWhenLocal(next);
    if (next === "schedule") sheetRef.current?.open();
    else setReturnAt(null);
  }, []);

  const handleConfirmed = useCallback((iso: string) => {
    setWhenLocal("schedule");
    setReturnAt(iso);
  }, []);

  const handleContinue = useCallback(() => {
    setReturnSwapAt(whenChoice === "schedule" ? returnAt : null);
    if (note.trim()) {
      // Append to whatever delivery already saved, separated by a divider.
      const existing = draft.note?.trim();
      const merged = existing
        ? `${existing}\n— Cylinder: ${note.trim()}`
        : note.trim();
      setNote(merged);
    }
    router.push("/(customer)/(order)/stations" as never);
  }, [setReturnSwapAt, whenChoice, returnAt, note, draft.note, setNote, router]);

  const scheduleSubLabel = useMemo(() => {
    if (whenChoice !== "schedule" || !returnAt) {
      return "Pick day & time";
    }
    return new Date(returnAt).toLocaleString("en-NG", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [whenChoice, returnAt]);

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      contentStyle={styles.scroll}
      header={<ScreenHeader title="Schedule return swap" />}
      footer={
        <FloatingCTA
          label="Continue · choose station"
          disabled={whenChoice === "schedule" && !returnAt}
          onPress={handleContinue}
          floating={false}
        />
      }
    >
      <View style={styles.body}>
        <ProgressDots step={step} total={total} variant="bars" />

        <Text style={styles.lead}>
          Want us to come back later for your empty cylinder? Pick "Now" if
          the rider should take it on the same trip, or "Schedule" to set a
          return time.
        </Text>

        <View style={styles.section}>
          <RadioGroup
            value={whenChoice}
            onChange={handleWhenChange}
            orientation="row"
          >
            <RadioOption
              value="now"
              label="Now"
              sublabel="Same trip — rider takes the empty when delivering"
            />
            <RadioOption
              value="schedule"
              label="Schedule"
              sublabel={scheduleSubLabel}
            />
          </RadioGroup>
          {whenChoice === "schedule" ? (
            <Pressable
              onPress={() => sheetRef.current?.open()}
              accessibilityRole="button"
              accessibilityLabel="Change return time"
              hitSlop={6}
            >
              <Text style={styles.changeTimeLink}>Change time</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.warnCard}>
          <Ionicons name="flame" size={18} color={theme.warning} />
          <View style={styles.warnBody}>
            <Text style={styles.warnTitle}>Have it ready & disconnected</Text>
            <Text style={styles.warnText}>
              Turn off the regulator, disconnect from the cooker, place
              outdoors. Rider won't enter the kitchen.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOTE FOR RIDER · OPTIONAL</Text>
          <View style={styles.noteWrap}>
            <TextInput
              value={note}
              onChangeText={(v) => setNoteLocal(v.slice(0, NOTE_MAX))}
              placeholder="Cylinder is at the back gate, security has the keys."
              placeholderTextColor={theme.fgSubtle}
              multiline
              maxLength={NOTE_MAX}
              accessibilityLabel="Note about the cylinder"
              style={styles.noteInput}
            />
          </View>
        </View>
      </View>

      <ReturnSwapSheet
        ref={sheetRef}
        value={returnAt}
        onChange={handleConfirmed}
      />
    </ScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: { paddingBottom: theme.space.s5 },
    body: {
      paddingHorizontal: theme.space.s4,
      gap: theme.space.s4,
      paddingTop: theme.space.s2,
    },
    lead: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    changeTimeLink: {
      ...theme.type.caption,
      color: theme.primary,
      fontWeight: "700",
      alignSelf: "flex-end",
      marginTop: theme.space.s2,
    },
    section: { gap: theme.space.s3 },
    sectionLabel: {
      ...theme.type.micro,
      fontSize: 13,
      letterSpacing: 0.6,
      color: theme.fgMuted,
    },
    warnCard: {
      flexDirection: "row",
      gap: theme.space.s3,
      backgroundColor: theme.warningTint,
      borderRadius: theme.radius.md,
      padding: theme.space.s3,
    },
    warnBody: { flex: 1, gap: 2 },
    warnTitle: {
      ...theme.type.body,
      color: theme.warning,
      fontWeight: "800",
    },
    warnText: {
      ...theme.type.bodySm,
      color: theme.fg,
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
  });
