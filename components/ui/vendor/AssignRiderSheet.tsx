import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import RiderCard, { type RiderStatus } from "./RiderCard";
import VendorEmptyState from "./VendorEmptyState";
import Skel, { SkelStack } from "./Skel";

/**
 * AssignRiderSheet — list + copy variant (v6 hard rule).
 *
 * Vendor opens this from the Order detail screen. Pulls the live
 * rider roster scoped to the order's station, shows each as a
 * RiderCard with tap-to-copy phone, and on tap-row calls the
 * assign / reassign endpoint.
 *
 * The caller imperatively opens via ref:
 *   const sheetRef = useRef<AssignRiderSheetRef>(null);
 *   sheetRef.current?.open({ orderId, stationId, mode: "assign" });
 */

export type AssignRiderMode = "assign" | "reassign";

export interface AssignRiderSheetRef {
  open: (opts: {
    orderId: string;
    stationId: string;
    mode?: AssignRiderMode;
    currentRiderId?: string | null;
  }) => void;
  close: () => void;
}

interface RiderApiRow {
  id: string;
  name: string;
  phone: string | null;
  plate: string | null;
  rating: number | null;
  trips: number;
  distanceKm: number | null;
  status: RiderStatus;
}

interface Props {
  /** Fires after a successful assign/reassign so the caller can refresh. */
  onAssigned?: (riderId: string) => void;
}

const AssignRiderSheet = forwardRef<AssignRiderSheetRef, Props>(
  function AssignRiderSheet({ onAssigned }, ref) {
    const theme = useTheme();
    const styles = useMemo(() => makeStyles(theme), [theme]);
    const sheetRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ["75%", "92%"], []);

    const [opts, setOpts] = useState<{
      orderId: string;
      stationId: string;
      mode: AssignRiderMode;
      currentRiderId: string | null;
    } | null>(null);
    const [riders, setRiders] = useState<RiderApiRow[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [assigning, setAssigning] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      open: ({ orderId, stationId, mode = "assign", currentRiderId = null }) => {
        setOpts({ orderId, stationId, mode, currentRiderId });
        sheetRef.current?.present();
      },
      close: () => sheetRef.current?.dismiss(),
    }));

    const fetchRiders = useCallback(async (stationId: string) => {
      setLoading(true);
      try {
        const res = await api.get<{ riders: RiderApiRow[] }>(
          `/api/vendor/riders?stationId=${encodeURIComponent(stationId)}`,
          { timeoutMs: 10_000 },
        );
        setRiders(res.riders ?? []);
      } catch {
        setRiders([]);
        toast.error("Couldn't load riders");
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => {
      if (!opts) return;
      fetchRiders(opts.stationId);
    }, [opts, fetchRiders]);

    const handleSelect = useCallback(
      async (riderId: string) => {
        if (!opts) return;
        if (assigning) return;
        // Block re-selecting the same rider on reassign.
        if (opts.mode === "reassign" && opts.currentRiderId === riderId) {
          toast.info("Already this rider");
          return;
        }
        setAssigning(riderId);
        try {
          const endpoint =
            opts.mode === "reassign"
              ? `/api/vendor/orders/${opts.orderId}/reassign`
              : `/api/vendor/orders/${opts.orderId}/assign`;
          await api.patch(endpoint, { riderId });
          toast.success(
            opts.mode === "reassign" ? "Rider swapped" : "Rider assigned",
          );
          onAssigned?.(riderId);
          sheetRef.current?.dismiss();
        } catch (err: any) {
          const msg =
            err?.message ??
            (opts.mode === "reassign"
              ? "Couldn't swap rider"
              : "Couldn't assign rider");
          toast.error(msg);
        } finally {
          setAssigning(null);
        }
      },
      [opts, assigning, onAssigned],
    );

    const header = (
      <View style={styles.header}>
        <Text style={styles.title}>
          {opts?.mode === "reassign" ? "Swap rider" : "Assign rider"}
        </Text>
        <Text style={styles.sub}>
          {opts?.mode === "reassign"
            ? "Pick a different rider for this order."
            : "Pick a rider — idle riders first."}
        </Text>
      </View>
    );

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        backgroundStyle={{ backgroundColor: theme.bg }}
        handleIndicatorStyle={{ backgroundColor: theme.fgMuted }}
        enablePanDownToClose
      >
        <BottomSheetScrollView contentContainerStyle={styles.scroll}>
          {header}

          {loading && !riders ? (
            <SkelStack gap={10}>
              <Skel height={72} radius={16} />
              <Skel height={72} radius={16} />
              <Skel height={72} radius={16} />
            </SkelStack>
          ) : !riders || riders.length === 0 ? (
            <VendorEmptyState
              icon="people-outline"
              headline="No riders yet"
              body="Invite a rider from the Team screen to start dispatching."
            />
          ) : (
            <View style={styles.list}>
              {riders.map((r) => (
                <View key={r.id} style={styles.row}>
                  <RiderCard
                    id={r.id}
                    name={r.name}
                    plate={r.plate ?? undefined}
                    rating={r.rating ?? undefined}
                    trips={r.trips}
                    distanceKm={r.distanceKm ?? undefined}
                    status={r.status}
                    phone={r.phone ?? undefined}
                    onSelect={handleSelect}
                  />
                  {assigning === r.id ? (
                    <View style={styles.spinnerOverlay}>
                      <ActivityIndicator color={theme.primary} />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

export default AssignRiderSheet;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 32,
      gap: 16,
    },
    header: {
      gap: 4,
    },
    title: {
      ...theme.type.h2,
      color: theme.fg,
    },
    sub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    list: { gap: 10 },
    row: { position: "relative" },
    spinnerOverlay: {
      position: "absolute",
      inset: 0,
      backgroundColor: theme.bg + "AA",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.lg,
    },
  });
