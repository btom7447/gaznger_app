import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";
import { useThemeStore } from "@/store/useThemeStore";
import {
  Button,
  EmptyState,
  ErrorStrip,
  FloatingCTA,
  LiveBadge,
  LiveStatus,
  MoneySurface,
  OfflineStrip,
  ProgressDots,
  RadioGroup,
  RadioOption,
  ReceiptRow,
  ScreenContainer,
  ScreenHeader,
  SelectCard,
  Skeleton,
  StatusBadge,
  Stepper,
} from "@/components/ui/primitives";

/**
 * Phase 1 primitive preview harness. Renders every primitive in the
 * current theme. Toggle theme via the chip in the header.
 *
 * Route: /(screens)/_primitives-preview
 *
 * Not user-facing — temporary harness for the customer revamp build.
 */
export default function PrimitivesPreview() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const setColorScheme = useThemeStore((s) => s.setColorScheme);
  const colorScheme = useThemeStore((s) => s.colorScheme);

  const [qty, setQty] = useState(15);
  const [radio, setRadio] = useState("now");
  const [selectedFuel, setSelectedFuel] = useState<string | null>("petrol");
  const [progress, setProgress] = useState(1);
  const [offlineForce, setOfflineForce] = useState(false);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("live");

  const cycleTheme = () => {
    setColorScheme(
      colorScheme === "light" ? "dark" : colorScheme === "dark" ? "system" : "light"
    );
  };

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      contentStyle={{ paddingBottom: 140 }}
    >
      <ScreenHeader
        title="Primitives"
        showBack
        trailing={{
          icon:
            colorScheme === "dark"
              ? "moon"
              : colorScheme === "light"
                ? "sunny"
                : "phone-portrait-outline",
          onPress: cycleTheme,
          accessibilityLabel: `Cycle theme. Currently ${colorScheme}.`,
        }}
      />

      <View style={styles.body}>
        <Section title="Theme state">
          <Text style={styles.kv}>colorScheme: {colorScheme}</Text>
          <Text style={styles.kv}>resolved mode: {theme.mode}</Text>
        </Section>

        <Section title="Buttons — variants × sizes">
          <View style={styles.col}>
            {(["primary", "secondary", "tertiary", "destructive", "ghost", "outline"] as const).map(
              (v) => (
                <View key={v} style={styles.row}>
                  <Button variant={v} size="sm" onPress={() => {}}>
                    {v}
                  </Button>
                  <Button variant={v} size="md" onPress={() => {}}>
                    {v}
                  </Button>
                  <Button variant={v} size="lg" onPress={() => {}}>
                    {v}
                  </Button>
                </View>
              )
            )}
          </View>
          <View style={styles.col}>
            <Button variant="primary" size="md" iconLeft="flash" onPress={() => {}}>
              With icon
            </Button>
            <Button variant="primary" size="lg" loading onPress={() => {}}>
              Loading
            </Button>
            <Button variant="primary" size="lg" disabled onPress={() => {}}>
              Disabled
            </Button>
            <Button
              variant="primary"
              size="lg"
              full
              subtitle="₦12,500 · GTB •••• 4892"
              onPress={() => {}}
            >
              Pay now
            </Button>
          </View>
        </Section>

        <Section title="Skeleton">
          <View style={styles.col}>
            <Skeleton width="60%" height={20} />
            <Skeleton width="100%" height={14} />
            <Skeleton width={120} height={32} borderRadius={theme.radius.md} />
          </View>
        </Section>

        <Section title="StatusBadge">
          <View style={styles.row}>
            <StatusBadge kind="success">Confirmed</StatusBadge>
            <StatusBadge kind="warning">Reconnecting</StatusBadge>
            <StatusBadge kind="error">Cancelled</StatusBadge>
          </View>
          <View style={styles.row}>
            <StatusBadge kind="info">Matching rider</StatusBadge>
            <StatusBadge kind="gold">Verified</StatusBadge>
            <StatusBadge kind="neutral">Closed</StatusBadge>
          </View>
          <View style={styles.row}>
            <StatusBadge kind="primary" pulse withDot>
              Dispensing
            </StatusBadge>
            <StatusBadge kind="success" compact withDot pulse>
              LIVE
            </StatusBadge>
          </View>
        </Section>

        <Section title="LiveBadge">
          <View style={styles.row}>
            {(["live", "reconnecting", "offline", "onSite"] as LiveStatus[]).map((s) => (
              <Pressable key={s} onPress={() => setLiveStatus(s)}>
                <LiveBadge status={s} />
              </Pressable>
            ))}
          </View>
          <Text style={styles.kv}>tap one — current: {liveStatus}</Text>
          <View>
            <LiveBadge status={liveStatus} />
          </View>
        </Section>

        <Section title="ProgressDots">
          <Text style={styles.kv}>bars (active widens) — step {progress}/4</Text>
          <ProgressDots step={progress} total={4} variant="bars" />
          <Text style={styles.kv}>dots</Text>
          <ProgressDots step={progress} total={4} variant="dots" />
          <View style={styles.row}>
            <Button
              variant="outline"
              size="sm"
              onPress={() => setProgress((p) => Math.max(0, p - 1))}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={() => setProgress((p) => Math.min(3, p + 1))}
            >
              Next
            </Button>
          </View>
        </Section>

        <Section title="RadioGroup — stack">
          <RadioGroup value={radio} onChange={setRadio}>
            <RadioOption value="now" label="Now" sublabel="Rider ~12 min away" />
            <RadioOption
              value="schedule"
              label="Schedule"
              sublabel="Pick a 30-min window"
              trailing="chevron"
            />
            <RadioOption value="later" label="Later" disabled />
          </RadioGroup>
        </Section>

        <Section title="RadioGroup — row">
          <RadioGroup value={radio} onChange={setRadio} orientation="row">
            <RadioOption value="now" label="Pick up now" sublabel="~12 min" />
            <RadioOption value="schedule" label="Schedule" sublabel="Pick day & time" />
          </RadioGroup>
        </Section>

        <Section title="SelectCard">
          <View style={styles.col}>
            <SelectCard
              variant="fuel"
              selected={selectedFuel === "petrol"}
              onPress={() => setSelectedFuel("petrol")}
              icon={<Ionicons name="flame" size={20} color={theme.primary} />}
              label="Petrol"
              sublabel="PMS"
            />
            <SelectCard
              variant="fuel"
              selected={selectedFuel === "diesel"}
              onPress={() => setSelectedFuel("diesel")}
              icon={
                <Ionicons name="flash" size={20} color={theme.fgMuted} />
              }
              label="Diesel"
              sublabel="AGO"
            />
            <SelectCard
              variant="generic"
              selected={false}
              onPress={() => {}}
              disabled
              disabledReason="Closest match is 14 km away"
              label="Kerosene"
              sublabel="DPK"
            />
          </View>
        </Section>

        <Section title="Stepper">
          <Stepper
            value={qty}
            onChange={setQty}
            min={5}
            max={200}
            unit="L"
            helper="Min 5 L · Max 200 L"
          />
        </Section>

        <Section title="EmptyState">
          <EmptyState
            icon="cube-outline"
            title="Order delivered. What's next?"
            body="Pick a fuel above. We'll handle the queue, the station and the rider."
          />
          <EmptyState
            icon="bicycle-outline"
            title="No active order"
            body="When you have an order in flight, you'll see it live here."
            action={{ label: "Place an order", onPress: () => {} }}
          />
        </Section>

        <Section title="ErrorStrip">
          <View style={styles.col}>
            <ErrorStrip
              variant="error"
              message="Card declined. Try another method."
              action={{ label: "Retry", onPress: () => {} }}
            />
            <ErrorStrip
              variant="warning"
              message="Showing prices from 4 min ago."
            />
            <ErrorStrip
              variant="info"
              message="Showing stations a bit further out."
            />
          </View>
        </Section>

        <Section title="OfflineStrip">
          <Button
            variant="outline"
            size="sm"
            onPress={() => setOfflineForce((v) => !v)}
          >
            {offlineForce ? "Hide forced offline" : "Force offline (preview)"}
          </Button>
          <OfflineStrip forceVisible={offlineForce} />
        </Section>

        <Section title="ReceiptRow">
          <View
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
              borderWidth: 1,
              borderRadius: theme.radius.lg,
              padding: theme.space.s4,
            }}
          >
            <ReceiptRow label="Petrol · 15 L" value={12000} />
            <ReceiptRow label="Delivery · Lekki" value={500} />
            <ReceiptRow label="Service" value="Free" />
            <View
              style={{
                height: 1,
                backgroundColor: theme.divider,
                marginVertical: theme.space.s2,
              }}
            />
            <ReceiptRow label="Total paid" value={12500} isTotal />
          </View>
        </Section>

        <Section title="MoneySurface — primary">
          <MoneySurface
            eyebrow="ORDER"
            lineItems={[
              { label: "15 L Petrol · NNPC Ikoyi", amount: 12000 },
              { label: "Delivery · Lekki", amount: 500 },
            ]}
            totalLabel="You'll pay"
            totalValue={12500}
            sub="Pay once · receipt to ada@example.com"
          />
        </Section>

        <Section title="MoneySurface — neutral">
          <MoneySurface
            emphasis="neutral"
            lineItems={[
              { label: "12.5 kg cylinder", amount: 11800 },
              { label: "Pickup", amount: 200 },
            ]}
            totalLabel="Estimated total"
            totalValue={12000}
          />
        </Section>
      </View>

      <FloatingCTA
        label="Continue · primitives compiling"
        subtitle="harness only"
        onPress={() => {}}
      />
    </ScreenContainer>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.col}>{children}</View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    body: {
      paddingHorizontal: theme.space.s4,
      gap: theme.space.s5,
      paddingBottom: theme.space.s5,
    },
    section: { gap: theme.space.s2 },
    sectionTitle: {
      ...theme.type.micro,
      color: theme.fgMuted,
    },
    col: { gap: theme.space.s2 },
    row: {
      flexDirection: "row",
      gap: theme.space.s2,
      flexWrap: "wrap",
      alignItems: "center",
    },
    kv: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
  });
