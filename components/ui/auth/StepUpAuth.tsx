import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { create } from "zustand";
import { Theme, useTheme } from "@/constants/theme";
import PinKeypad from "@/components/ui/primitives/PinKeypad";
import {
  authenticateBiometric,
  checkBiometricAvailability,
  biometricLabel,
  type BiometricType,
} from "@/lib/permissions";
import { getBiometricEnabled } from "@/lib/auth";
import { api } from "@/lib/api";

/**
 * Step-up authentication for sensitive actions (delete account, payment
 * confirm, big withdrawals). Two paths:
 *
 *   1. **Biometric** — preferred when enabled + available. Native OS
 *      prompt; success returns true immediately.
 *   2. **PIN sheet** — universal fallback. Bottom sheet with the same
 *      4-digit keypad as the unlock screens. Submits to
 *      `/auth/pin/verify` (which has the per-account lockout from
 *      audit A.4 wired in).
 *
 * Usage:
 *
 *     const ok = await requireStepUpAuth({ reason: "Confirm to delete account" });
 *     if (!ok) return; // user cancelled or failed
 *
 * Mounting:
 *
 *     <StepUpAuthHost />  // once, at app root
 *
 * The host owns a BottomSheetModal. The function-style helper resolves
 * the call's promise via a Zustand store that the host listens to.
 */

interface StepUpResolver {
  /** Resolved with `{ok, pin?}`. PIN only included when caller
   *  asked for it via `wantPin: true`. */
  resolve: (result: { ok: boolean; pin?: string }) => void;
  reason: string;
  /** When true, the host returns the entered PIN to the caller and
   *  forces the PIN-sheet path (skips biometric). Used by flows
   *  that need to forward the raw PIN to the server (e.g. enabling
   *  bio-login, which stores `{phone, pin}` for later sign-ins). */
  wantPin?: boolean;
}

interface StepUpStore {
  pending: StepUpResolver | null;
  request: (req: StepUpResolver) => void;
  clear: () => void;
}

const useStepUpStore = create<StepUpStore>((set) => ({
  pending: null,
  request: (req) => set({ pending: req }),
  clear: () => set({ pending: null }),
}));

/**
 * Public helper. Returns true on successful auth (biometric OR PIN),
 * false on cancel / fail / no PIN configured.
 */
export async function requireStepUpAuth(opts: {
  /** One-line reason shown on the OS biometric prompt + sheet header. */
  reason: string;
}): Promise<boolean> {
  // Try biometric first when the user enrolled.
  const [bioEnabled, avail] = await Promise.all([
    getBiometricEnabled(),
    checkBiometricAvailability(),
  ]);
  if (bioEnabled && avail.available) {
    const ok = await authenticateBiometric(opts.reason);
    if (ok) return true;
    // Fall through to PIN sheet on cancel/fail rather than rejecting
    // outright — user might prefer PIN today (e.g. wet hands → fingerprint
    // failed; they want to type instead).
  }

  // PIN-sheet fallback. The host listens to the store and surfaces
  // the modal. We resolve when the host calls our resolver.
  return new Promise<boolean>((resolve) => {
    useStepUpStore.getState().request({
      resolve: (r) => resolve(r.ok),
      reason: opts.reason,
    });
  });
}

/**
 * Variant of `requireStepUpAuth` that ALSO returns the user's PIN on
 * success. Used by flows that need to forward the raw PIN to the
 * server (enabling bio-login, account deletion confirm — anything
 * that calls a server route which itself bcrypt-compares the PIN).
 *
 * Skips the biometric shortcut entirely — biometric proves identity
 * but doesn't yield a PIN string. Always opens the keypad sheet.
 */
export async function requireStepUpPin(opts: {
  reason: string;
}): Promise<{ ok: boolean; pin?: string }> {
  return new Promise((resolve) => {
    useStepUpStore.getState().request({
      resolve,
      reason: opts.reason,
      wantPin: true,
    });
  });
}

/**
 * Mount once at the app root. Renders a hidden BottomSheetModal that
 * shows up whenever `requireStepUpAuth` is called and biometric was
 * unavailable / refused. PIN entry is keypad-only (no system keyboard).
 */
export function StepUpAuthHost() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const sheetRef = useRef<BottomSheetModal>(null);
  const pending = useStepUpStore((s) => s.pending);
  const clear = useStepUpStore((s) => s.clear);

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bioType, setBioType] = useState<BiometricType>("none");

  useEffect(() => {
    if (pending) {
      setPin("");
      setError(null);
      setBusy(false);
      checkBiometricAvailability().then((a) => setBioType(a.type));
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [pending]);

  const submitPin = useCallback(
    async (entered: string) => {
      if (!pending) return;
      setBusy(true);
      setError(null);
      try {
        await api.post<{ ok: boolean }>("/auth/pin/verify", { pin: entered });
        // Forward PIN to caller iff they asked for it (e.g. enabling
        // bio-login needs the raw PIN to stash). Otherwise just signal
        // success — the PIN never leaves this closure.
        pending.resolve(
          pending.wantPin ? { ok: true, pin: entered } : { ok: true }
        );
        clear();
      } catch (err: any) {
        const msg = err?.message ?? "Incorrect PIN";
        setError(msg);
        setPin("");
      } finally {
        setBusy(false);
      }
    },
    [pending, clear]
  );

  const handleDigit = useCallback(
    (d: string) => {
      if (busy) return;
      setPin((cur) => {
        if (cur.length >= 4) return cur;
        const next = cur + d;
        if (next.length === 4) {
          // Defer so the dot for the 4th digit paints first.
          setTimeout(() => submitPin(next), 50);
        }
        return next;
      });
      setError(null);
    },
    [busy, submitPin]
  );

  const handleBackspace = useCallback(() => {
    if (busy) return;
    setPin((cur) => cur.slice(0, -1));
    setError(null);
  }, [busy]);

  const handleBiometric = useCallback(async () => {
    if (!pending || busy) return;
    // wantPin flows must NOT use biometric — they need the PIN
    // string. Hide the bio shortcut when the request explicitly
    // asks for the PIN value.
    if (pending.wantPin) return;
    setBusy(true);
    const ok = await authenticateBiometric(pending.reason);
    setBusy(false);
    if (ok) {
      pending.resolve({ ok: true });
      clear();
    }
  }, [pending, busy, clear]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["62%"]}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.bg }}
      handleIndicatorStyle={{ backgroundColor: theme.borderStrong }}
      onDismiss={() => {
        // User dragged-down or backdrop tapped — treat as cancel.
        if (pending) {
          pending.resolve({ ok: false });
          clear();
        }
      }}
    >
      <BottomSheetView style={styles.root}>
        <Text style={styles.title}>Confirm with PIN</Text>
        <Text style={styles.sub}>
          {pending?.reason ?? "Enter your 4-digit PIN to continue"}
        </Text>
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                pin.length > i && styles.dotFilled,
                error && styles.dotError,
              ]}
            />
          ))}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <PinKeypad
          // Hide the biometric shortcut when the caller explicitly
          // wants the PIN string (wantPin) — biometric proves
          // identity but doesn't yield a PIN, so the shortcut would
          // dead-end. Otherwise the bio glyph is just a UX
          // affordance for users who'd rather not retype.
          biometric={
            pending?.wantPin
              ? null
              : bioType === "face" || bioType === "touch"
              ? bioType
              : null
          }
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          onBiometric={handleBiometric}
          disabled={busy}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 8,
      alignItems: "center",
    },
    title: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.fg,
      marginBottom: 4,
    },
    sub: {
      fontSize: 13,
      color: theme.fgMuted,
      textAlign: "center",
      marginBottom: 18,
    },
    dotsRow: {
      flexDirection: "row",
      gap: 14,
      marginBottom: 6,
    },
    dot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: theme.bgMuted,
      borderWidth: 1.5,
      borderColor: theme.divider,
    },
    dotFilled: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    dotError: {
      borderColor: theme.error,
    },
    errorText: {
      fontSize: 12,
      color: theme.error,
      marginTop: 6,
      marginBottom: 6,
    },
  });
