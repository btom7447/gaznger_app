import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
 * Vendor onboarding wizard — v7 unified auth.
 *
 *   Step 1 — Business    (owner name + business name + business email)
 *   Step 2 — First station (name + address picker + state + lga + hours + fuels[])
 *   Step 3 — Bank         (skippable — pick bank, NUBAN, auto-resolve name)
 *
 * Finish routes to /(auth)/verification/pending?role=vendor. KYC docs
 * happen later from the pending screen via /verification/vendor.
 *
 * Server calls:
 *   Step 1 Continue → PUT /auth/me { displayName, email, vendorBusinessName }
 *   Step 2 Continue → POST /api/vendor/stations { name, address, state, lga,
 *                       location, operatingHours, fuels: [{ fuel, pricePerUnit, available }] }
 *   Step 3 Finish   → POST /api/vendor/banks/saved { bankName, bankCode, accountNumber, stationId }
 *                     (skippable)
 */

interface PaystackBank {
  id: number;
  name: string;
  code: string;
}

interface FuelTypeRow {
  _id: string;
  name: string;
  unit: string;
}

interface BanksResp {
  banks: PaystackBank[];
}

interface ResolveResp {
  account_name?: string;
}

const DEFAULT_HOURS = { open: "06:00", close: "22:00" };

const BANK_SHORT_NAMES: Record<string, string> = {
  "guaranty trust bank": "GTBank",
  "access bank": "Access",
  "zenith bank": "Zenith",
  "first bank of nigeria": "First Bank",
  "united bank for africa": "UBA",
  "ecobank nigeria": "Ecobank",
  "stanbic ibtc bank": "Stanbic",
  "polaris bank": "Polaris",
  "sterling bank": "Sterling",
  "fidelity bank": "Fidelity",
  "wema bank": "Wema",
  "union bank of nigeria": "Union",
  "kuda microfinance bank": "Kuda",
  "opay digital services limited (opay)": "OPay",
  "palmpay": "PalmPay",
};

function bankShortName(name: string): string {
  return BANK_SHORT_NAMES[name.toLowerCase()] ?? name;
}

function bankInitials(name: string): string {
  const short = bankShortName(name);
  return short
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function VendorWizardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const updateUser = useSessionStore((s) => s.updateUser);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — Business
  const [ownerName, setOwnerName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");

  // Step 2 — Station
  const [stationName, setStationName] = useState("");
  const [stationAddress, setStationAddress] = useState<AddressResult | null>(
    null,
  );
  const [openTime, setOpenTime] = useState(DEFAULT_HOURS.open);
  const [closeTime, setCloseTime] = useState(DEFAULT_HOURS.close);
  const [fuelTypes, setFuelTypes] = useState<FuelTypeRow[]>([]);
  const [pickedFuels, setPickedFuels] = useState<
    Record<string, { selected: boolean; price: string }>
  >({});
  const [createdStationId, setCreatedStationId] = useState<string | null>(null);
  const addressSheetRef = useRef<AddressSheetRef>(null);

  // Step 3 — Bank
  const [banks, setBanks] = useState<PaystackBank[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickedBank, setPickedBank] = useState<PaystackBank | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Load fuel types when entering Step 2.
  useEffect(() => {
    if (step !== 2 || fuelTypes.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<FuelTypeRow[] | { fuelTypes: FuelTypeRow[] }>(
          "/api/fuel-types",
          { timeoutMs: 10_000 },
        );
        const list = Array.isArray(res) ? res : res.fuelTypes ?? [];
        if (cancelled) return;
        setFuelTypes(list);
      } catch {
        // empty — user can still proceed if API down (rare)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, fuelTypes.length]);

  // Load banks when entering Step 3.
  useEffect(() => {
    if (step !== 3 || banks !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<BanksResp>("/api/vendor/banks", {
          timeoutMs: 15_000,
        });
        if (!cancelled) setBanks(res.banks ?? []);
      } catch {
        if (!cancelled) setBanks([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, banks]);

  // Auto-resolve bank account when both fields are filled.
  useEffect(() => {
    setResolvedName(null);
    setResolveError(null);
    if (!pickedBank || accountNumber.length !== 10) return;
    let cancelled = false;
    setResolving(true);
    (async () => {
      try {
        const res = await api.get<ResolveResp>(
          `/api/vendor/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(pickedBank.code)}`,
          { timeoutMs: 15_000 },
        );
        if (cancelled) return;
        if (res.account_name) setResolvedName(res.account_name);
        else setResolveError("Couldn't verify account.");
      } catch (err: any) {
        if (!cancelled) {
          setResolveError(err?.message ?? "Couldn't verify account.");
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickedBank, accountNumber]);

  // Defaults derived from Step 1 — station name falls back to business
  // name when empty.
  const effectiveStationName = stationName.trim() || businessName.trim();

  const step1Valid =
    ownerName.trim().length >= 2 &&
    businessName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessEmail.trim());

  const fuelsSelected = useMemo(
    () =>
      fuelTypes
        .filter((f) => pickedFuels[f._id]?.selected)
        .map((f) => ({
          fuel: f,
          price: parseFloat(pickedFuels[f._id]?.price ?? "0"),
        })),
    [fuelTypes, pickedFuels],
  );

  const step2Valid =
    !!effectiveStationName &&
    !!stationAddress &&
    !!openTime.trim() &&
    !!closeTime.trim() &&
    fuelsSelected.length > 0 &&
    fuelsSelected.every((f) => Number.isFinite(f.price) && f.price > 0);

  const handleStep1Continue = useCallback(async () => {
    if (!step1Valid || submitting) return;
    setSubmitting(true);
    try {
      const data = await api.put<{
        displayName?: string;
        email?: string;
        vendorBusinessName?: string;
      }>("/auth/me", {
        displayName: ownerName.trim(),
        email: businessEmail.trim(),
        vendorBusinessName: businessName.trim(),
      });
      updateUser({
        displayName: data.displayName,
        email: data.email ?? "",
        vendorBusinessName: data.vendorBusinessName,
      });
      // Default station name to business name on first entry to Step 2.
      if (!stationName.trim()) setStationName(businessName.trim());
      setStep(2);
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't save business details.");
    } finally {
      setSubmitting(false);
    }
  }, [
    step1Valid,
    submitting,
    ownerName,
    businessName,
    businessEmail,
    stationName,
    updateUser,
  ]);

  const handleStep2Continue = useCallback(async () => {
    if (!step2Valid || !stationAddress || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.post<{ stationId: string }>(
        "/api/vendor/stations",
        {
          name: effectiveStationName,
          address: stationAddress.address,
          state: stationAddress.stateLabel || stationAddress.state,
          lga: stationAddress.lga,
          location: {
            lat: stationAddress.latitude,
            lng: stationAddress.longitude,
          },
          operatingHours: { open: openTime.trim(), close: closeTime.trim() },
          fuels: fuelsSelected.map((f) => ({
            fuel: f.fuel._id,
            pricePerUnit: Math.round(f.price),
            available: true,
          })),
        },
      );
      setCreatedStationId(res.stationId);
      setStep(3);
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't create station.");
    } finally {
      setSubmitting(false);
    }
  }, [
    step2Valid,
    stationAddress,
    submitting,
    effectiveStationName,
    openTime,
    closeTime,
    fuelsSelected,
  ]);

  const finishToPending = useCallback(() => {
    router.replace("/(auth)/verification/pending?role=vendor" as never);
  }, [router]);

  const handleStep3Finish = useCallback(async () => {
    if (submitting) return;
    if (!pickedBank || accountNumber.length !== 10 || !resolvedName) {
      toast.error("Pick a bank and enter a 10-digit account number.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/vendor/banks/saved", {
        bankName: pickedBank.name,
        bankCode: pickedBank.code,
        accountNumber,
        stationId: createdStationId,
      });
      finishToPending();
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't save bank.");
      setSubmitting(false);
    }
  }, [
    submitting,
    pickedBank,
    accountNumber,
    resolvedName,
    createdStationId,
    finishToPending,
  ]);

  const handleSkipBank = useCallback(() => {
    finishToPending();
  }, [finishToPending]);

  const handleBack = useCallback(() => {
    if (step === 1) {
      router.back();
      return;
    }
    setStep((s) => Math.max(1, (s - 1) as 1 | 2 | 3) as 1 | 2 | 3);
  }, [step, router]);

  const filteredBanks = useMemo(() => {
    if (!banks) return [];
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter((b) => b.name.toLowerCase().includes(q));
  }, [banks, pickerQuery]);

  return (
    <AuthScreenContainer
      contentStyle={{ paddingTop: 0, paddingHorizontal: 0 }}
      background={theme.bgMuted}
      footer={
        step === 3 ? (
          <View style={{ gap: 8 }}>
            <Button
              variant="primary"
              size="lg"
              full
              onPress={handleStep3Finish}
              loading={submitting}
              disabled={
                submitting ||
                !pickedBank ||
                accountNumber.length !== 10 ||
                !resolvedName
              }
              accessibilityLabel="Finish vendor setup"
            >
              {submitting ? "Saving…" : "Finish"}
            </Button>
            <Pressable
              onPress={handleSkipBank}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Skip bank for now"
              style={styles.skipBtn}
            >
              <Text style={styles.skipText}>Skip for now · add bank later</Text>
            </Pressable>
          </View>
        ) : (
          <Button
            variant="primary"
            size="lg"
            full
            onPress={step === 1 ? handleStep1Continue : handleStep2Continue}
            loading={submitting}
            disabled={
              submitting ||
              (step === 1 ? !step1Valid : !step2Valid)
            }
            accessibilityLabel="Continue"
          >
            {submitting ? "Saving…" : "Continue"}
          </Button>
        )
      }
    >
      <WizardHeader
        step={step}
        total={3}
        onBack={handleBack}
        theme={theme}
        styles={styles}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 1 ? (
          <Step1Business
            ownerName={ownerName}
            businessName={businessName}
            businessEmail={businessEmail}
            setOwnerName={setOwnerName}
            setBusinessName={setBusinessName}
            setBusinessEmail={setBusinessEmail}
            theme={theme}
            styles={styles}
          />
        ) : null}

        {step === 2 ? (
          <Step2Station
            stationName={stationName}
            stationAddress={stationAddress}
            openTime={openTime}
            closeTime={closeTime}
            fuelTypes={fuelTypes}
            pickedFuels={pickedFuels}
            businessName={businessName}
            setStationName={setStationName}
            setOpenTime={setOpenTime}
            setCloseTime={setCloseTime}
            setPickedFuels={setPickedFuels}
            onPickAddress={() => addressSheetRef.current?.open()}
            theme={theme}
            styles={styles}
          />
        ) : null}

        {step === 3 ? (
          <Step3Bank
            banks={banks}
            pickedBank={pickedBank}
            accountNumber={accountNumber}
            resolving={resolving}
            resolvedName={resolvedName}
            resolveError={resolveError}
            setAccountNumber={setAccountNumber}
            onOpenPicker={() => setPickerOpen(true)}
            theme={theme}
            styles={styles}
          />
        ) : null}
      </ScrollView>

      <AddressSheet
        ref={addressSheetRef}
        onConfirm={setStationAddress}
        copy={{
          title: "Station address",
          sub: "Search the address, then drag the pin to refine.",
          searchPlaceholder: "Search station address",
          confirmLabel: "Use this address",
        }}
      />

      {/* Bank picker modal */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose bank</Text>
              <Pressable
                onPress={() => setPickerOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={6}
              >
                <Ionicons name="close" size={22} color={theme.fg} />
              </Pressable>
            </View>
            <TextInput
              style={styles.search}
              placeholder="Search banks"
              placeholderTextColor={theme.fgMuted}
              value={pickerQuery}
              onChangeText={setPickerQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <FlatList
              data={filteredBanks}
              keyExtractor={(b) => String(b.id ?? b.code)}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={styles.modalSep} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setPickedBank(item);
                    setPickerOpen(false);
                    setPickerQuery("");
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.modalRow,
                    pressed && { backgroundColor: theme.bgMuted },
                  ]}
                >
                  <Text style={styles.modalRowText} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {pickedBank?.code === item.code ? (
                    <Ionicons name="checkmark" size={18} color={theme.primary} />
                  ) : null}
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>No matches.</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </AuthScreenContainer>
  );
}

/* ─────────────── Wizard chrome ─────────────── */

function WizardHeader({
  step,
  total,
  onBack,
  theme,
  styles,
}: {
  step: number;
  total: number;
  onBack: () => void;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.wizardHeader}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={6}
        style={({ pressed }) => [
          styles.headerBackBtn,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons name="chevron-back" size={22} color={theme.fg} />
      </Pressable>
      <View style={styles.progressTrack}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressSeg,
              i < step && styles.progressSegActive,
            ]}
          />
        ))}
      </View>
      <Text style={styles.progressCount}>
        {step}/{total}
      </Text>
    </View>
  );
}

function StepHeading({
  eyebrow,
  title,
  sub,
  theme,
  styles,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.stepHeading}>
      <Text style={styles.stepEyebrow}>{eyebrow}</Text>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepSub}>{sub}</Text>
    </View>
  );
}

/* ─────────────── Step 1 ─────────────── */

function Step1Business({
  ownerName,
  businessName,
  businessEmail,
  setOwnerName,
  setBusinessName,
  setBusinessEmail,
  theme,
  styles,
}: {
  ownerName: string;
  businessName: string;
  businessEmail: string;
  setOwnerName: (v: string) => void;
  setBusinessName: (v: string) => void;
  setBusinessEmail: (v: string) => void;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View>
      <StepHeading
        eyebrow="Step 1 of 3 · Business"
        title="Tell us about your business"
        sub="The basics — we'll ask for CAC and NMDPRA documents at the verification step."
        theme={theme}
        styles={styles}
      />
      <View style={styles.fields}>
        <V7Field
          label="Owner name"
          required
          value={ownerName}
          onChangeText={setOwnerName}
          placeholder="Your full name"
          autoCapitalize="words"
        />
        <V7Field
          label="Business name"
          required
          hint="As you'd want it shown to customers."
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="e.g. Abkon Oil Ltd"
          autoCapitalize="words"
        />
        <V7Field
          label="Business email"
          required
          value={businessEmail}
          onChangeText={setBusinessEmail}
          placeholder="business@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <View style={styles.infoNote}>
          <Ionicons name="information-circle" size={18} color={theme.info} />
          <Text style={styles.infoText}>
            You'll set up your first station next. Stations, fuels, and bank
            can all be edited later.
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ─────────────── Step 2 ─────────────── */

function Step2Station({
  stationName,
  stationAddress,
  openTime,
  closeTime,
  fuelTypes,
  pickedFuels,
  businessName,
  setStationName,
  setOpenTime,
  setCloseTime,
  setPickedFuels,
  onPickAddress,
  theme,
  styles,
}: {
  stationName: string;
  stationAddress: AddressResult | null;
  openTime: string;
  closeTime: string;
  fuelTypes: FuelTypeRow[];
  pickedFuels: Record<string, { selected: boolean; price: string }>;
  businessName: string;
  setStationName: (v: string) => void;
  setOpenTime: (v: string) => void;
  setCloseTime: (v: string) => void;
  setPickedFuels: (
    next: Record<string, { selected: boolean; price: string }>,
  ) => void;
  onPickAddress: () => void;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View>
      <StepHeading
        eyebrow="Step 2 of 3 · First station"
        title="Add your first station"
        sub="So your Today screen has something to show when you sign in."
        theme={theme}
        styles={styles}
      />
      <View style={styles.fields}>
        <V7Field
          label="Station name"
          required
          hint="Defaults to your business name if you leave it blank."
          value={stationName}
          onChangeText={setStationName}
          placeholder={businessName || "e.g. Abkon — Lekki"}
          autoCapitalize="words"
        />

        {/* Address picker — opens AddressSheet for Places autocomplete */}
        <View>
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>Address</Text>
            <Text style={styles.requiredMark}> ·</Text>
          </View>
          <Pressable
            onPress={onPickAddress}
            accessibilityRole="button"
            accessibilityLabel={
              stationAddress
                ? `Station address: ${stationAddress.address}. Tap to change.`
                : "Pick station address"
            }
            style={({ pressed }) => [
              styles.addressField,
              stationAddress ? styles.addressFieldFilled : null,
              pressed && { opacity: 0.94 },
            ]}
          >
            <Ionicons
              name="location"
              size={18}
              color={stationAddress ? theme.primary : theme.fgMuted}
            />
            <Text
              style={[
                styles.addressText,
                !stationAddress && { color: theme.fgMuted },
              ]}
              numberOfLines={1}
            >
              {stationAddress
                ? stationAddress.address
                : "Type to search Google Places"}
            </Text>
            <Ionicons
              name={stationAddress ? "create-outline" : "chevron-forward"}
              size={18}
              color={theme.fgMuted}
            />
          </Pressable>
          {!stationAddress ? (
            <Text style={styles.fieldHintInline}>
              We use this to match nearby customers.
            </Text>
          ) : null}
        </View>

        {/* State + LGA — auto-filled from Places, displayed as 2-col grid */}
        {stationAddress ? (
          <View style={styles.gridRow}>
            <View style={styles.gridCol}>
              <Text style={styles.fieldLabel}>State</Text>
              <View style={styles.readonlyField}>
                <Text style={styles.readonlyText} numberOfLines={1}>
                  {stationAddress.stateLabel || stationAddress.state || "—"}
                </Text>
              </View>
            </View>
            <View style={styles.gridCol}>
              <Text style={styles.fieldLabel}>LGA</Text>
              <View style={styles.readonlyField}>
                <Text style={styles.readonlyText} numberOfLines={1}>
                  {stationAddress.lga || "—"}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Operating hours */}
        <View>
          <Text style={styles.fieldLabel}>Operating hours</Text>
          <View style={styles.hoursRow}>
            <TimePickerCard
              label="Opens"
              value={openTime}
              onChange={setOpenTime}
              theme={theme}
              styles={styles}
            />
            <TimePickerCard
              label="Closes"
              value={closeTime}
              onChange={setCloseTime}
              theme={theme}
              styles={styles}
            />
          </View>
        </View>

        {/* Fuels */}
        <View>
          <Text style={styles.fieldLabel}>Fuels you sell</Text>
          {fuelTypes.length === 0 ? (
            <View style={styles.fuelLoading}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : (
            <View style={styles.fuelList}>
              {fuelTypes.map((f) => {
                const state = pickedFuels[f._id] ?? {
                  selected: false,
                  price: "",
                };
                return (
                  <FuelRow
                    key={f._id}
                    fuel={f}
                    selected={state.selected}
                    price={state.price}
                    onToggle={() =>
                      setPickedFuels({
                        ...pickedFuels,
                        [f._id]: {
                          selected: !state.selected,
                          price: state.price,
                        },
                      })
                    }
                    onPrice={(p) =>
                      setPickedFuels({
                        ...pickedFuels,
                        [f._id]: { selected: true, price: p },
                      })
                    }
                    theme={theme}
                  />
                );
              })}
            </View>
          )}
          <Text style={styles.fieldHint}>
            Customers see these prices on the order screen. You can change
            them anytime from Catalog.
          </Text>
        </View>
      </View>
    </View>
  );
}

function TimePickerCard({
  label,
  value,
  onChange,
  theme,
  styles,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}) {
  // Tappable card UI per v7 design. We don't yet have a native time
  // picker dep, so the card focuses an inline TextInput on press — same
  // visual language as the spec, plus a fallback that works today.
  const inputRef = React.useRef<TextInput>(null);
  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      accessibilityRole="button"
      accessibilityLabel={`${label} time, ${value}`}
      style={({ pressed }) => [
        styles.timeCard,
        pressed && { opacity: 0.94 },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.timeCardLabel}>{label}</Text>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          placeholder="06:00"
          placeholderTextColor={theme.fgMuted}
          style={styles.timeCardValue}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          accessibilityLabel={`${label} time`}
        />
      </View>
      <Ionicons name="chevron-down" size={16} color={theme.fgMuted} />
    </Pressable>
  );
}

function FuelRow({
  fuel,
  selected,
  price,
  onToggle,
  onPrice,
  theme,
}: {
  fuel: FuelTypeRow;
  selected: boolean;
  price: string;
  onToggle: () => void;
  onPrice: (v: string) => void;
  theme: Theme;
}) {
  return (
    <View
      style={[
        fuelStyles(theme).row,
        selected && fuelStyles(theme).rowActive,
      ]}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`Toggle ${fuel.name}`}
        hitSlop={6}
        style={[
          fuelStyles(theme).check,
          selected && fuelStyles(theme).checkActive,
        ]}
      >
        {selected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={fuelStyles(theme).name}>{fuel.name}</Text>
        <Text style={fuelStyles(theme).unit}>
          ₦/{fuel.unit ?? "L"} · starter price
        </Text>
      </View>
      {selected ? (
        <View style={fuelStyles(theme).pricePill}>
          <Text style={fuelStyles(theme).pricePrefix}>₦</Text>
          <TextInput
            value={price}
            onChangeText={(t) => onPrice(t.replace(/[^0-9.]/g, ""))}
            placeholder="0"
            placeholderTextColor={theme.fgMuted}
            keyboardType="decimal-pad"
            style={fuelStyles(theme).priceInput}
            accessibilityLabel={`${fuel.name} price`}
          />
        </View>
      ) : null}
    </View>
  );
}

/* ─────────────── Step 3 ─────────────── */

function Step3Bank({
  banks,
  pickedBank,
  accountNumber,
  resolving,
  resolvedName,
  resolveError,
  setAccountNumber,
  onOpenPicker,
  theme,
  styles,
}: {
  banks: PaystackBank[] | null;
  pickedBank: PaystackBank | null;
  accountNumber: string;
  resolving: boolean;
  resolvedName: string | null;
  resolveError: string | null;
  setAccountNumber: (v: string) => void;
  onOpenPicker: () => void;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View>
      <StepHeading
        eyebrow="Step 3 of 3 · Bank"
        title="Where should we send your money?"
        sub="Daily settlements land here. You can skip this and add it later."
        theme={theme}
        styles={styles}
      />
      <View style={styles.fields}>
        <View>
          <Text style={styles.fieldLabel}>Bank</Text>
          <Pressable
            onPress={onOpenPicker}
            disabled={banks === null}
            accessibilityRole="button"
            accessibilityLabel={
              pickedBank ? `Bank: ${pickedBank.name}. Tap to change.` : "Choose bank"
            }
            style={({ pressed }) => [
              styles.bankPicker,
              pressed && { opacity: 0.92 },
            ]}
          >
            {banks === null ? (
              <ActivityIndicator color={theme.primary} />
            ) : pickedBank ? (
              <>
                <View style={styles.bankBrandTile}>
                  <Text style={styles.bankBrandText}>
                    {bankInitials(pickedBank.name)}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.bankPickerText} numberOfLines={1}>
                    {bankShortName(pickedBank.name)}
                  </Text>
                  <Text style={styles.bankPickerSub} numberOfLines={1}>
                    {pickedBank.code} · {pickedBank.name}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={theme.fgMuted} />
              </>
            ) : (
              <>
                <Ionicons name="search" size={18} color={theme.fgMuted} />
                <Text
                  style={[styles.bankPickerText, { color: theme.fgMuted, flex: 1 }]}
                  numberOfLines={1}
                >
                  Pick a bank
                </Text>
                <Ionicons name="chevron-down" size={16} color={theme.fgMuted} />
              </>
            )}
          </Pressable>
        </View>

        <V7Field
          label="Account number"
          required
          value={accountNumber}
          onChangeText={(t) =>
            setAccountNumber(t.replace(/[^0-9]/g, "").slice(0, 10))
          }
          placeholder="10-digit NUBAN"
          keyboardType="number-pad"
          autoCapitalize="none"
          hint={
            !resolvedName && !resolveError && accountNumber.length === 0
              ? "We'll resolve the account name automatically."
              : undefined
          }
        />

        {resolving ? (
          <View style={styles.resolveRow}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={styles.resolveText}>Verifying…</Text>
          </View>
        ) : resolvedName ? (
          <View style={styles.resolveOk}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                backgroundColor: theme.success,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resolveLabel}>Account name</Text>
              <Text style={styles.resolveName} numberOfLines={1}>
                {resolvedName.toUpperCase()}
              </Text>
            </View>
          </View>
        ) : resolveError ? (
          <Text style={styles.resolveError}>{resolveError}</Text>
        ) : accountNumber.length > 0 && accountNumber.length < 10 ? (
          <Text style={styles.fieldHint}>
            {10 - accountNumber.length} more digit
            {10 - accountNumber.length === 1 ? "" : "s"}
          </Text>
        ) : null}

        <View style={styles.infoNote}>
          <Ionicons name="shield-checkmark" size={18} color={theme.info} />
          <Text style={styles.infoText}>
            We never store card details. Settlements use Paystack and only
            require your bank + NUBAN.
          </Text>
        </View>
      </View>
    </View>
  );
}

const fuelStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 1.5,
      borderColor: theme.divider,
      marginBottom: 8,
    },
    rowActive: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
    },
    check: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.8,
      borderColor: theme.divider,
      alignItems: "center",
      justifyContent: "center",
    },
    checkActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    name: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
    unit: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginTop: 2,
    },
    pricePill: {
      height: 36,
      minWidth: 88,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.palette.green100,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    pricePrefix: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.palette.green700,
    },
    priceInput: {
      flex: 1,
      fontSize: 14,
      fontWeight: "800",
      color: theme.palette.green700,
      textAlign: "right",
      paddingVertical: 0,
    },
  });

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wizardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    headerBackBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.bgMuted,
    },
    progressTrack: {
      flex: 1,
      flexDirection: "row",
      gap: 6,
    },
    progressSeg: {
      flex: 1,
      height: 6,
      borderRadius: 999,
      backgroundColor: theme.divider,
    },
    progressSegActive: {
      backgroundColor: theme.primary,
    },
    progressCount: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.fgMuted,
      minWidth: 32,
      textAlign: "right",
    },
    scroll: {
      paddingHorizontal: 16,
      paddingBottom: 140,
    },
    stepHeading: {
      paddingHorizontal: 4,
      paddingBottom: 16,
      gap: 4,
    },
    stepEyebrow: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: theme.info,
    },
    stepTitle: {
      ...theme.type.h1,
      color: theme.fg,
      fontWeight: "800",
      letterSpacing: -0.3,
      fontSize: 22,
      marginTop: 4,
    },
    stepSub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      lineHeight: 20,
      marginTop: 4,
    },
    fields: {
      gap: 12,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: theme.fgMuted,
      marginBottom: 6,
      marginHorizontal: 2,
    },
    fieldHint: {
      fontSize: 11.5,
      color: theme.fgMuted,
      marginTop: 8,
      marginHorizontal: 2,
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
      marginHorizontal: 2,
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
    fieldHintInline: {
      marginTop: 6,
      fontSize: 11.5,
      color: theme.fgMuted,
      marginHorizontal: 2,
    },
    gridRow: {
      flexDirection: "row",
      gap: 10,
    },
    gridCol: {
      flex: 1,
    },
    readonlyField: {
      height: 52,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: theme.bgMuted,
      borderWidth: 1,
      borderColor: theme.divider,
      justifyContent: "center",
    },
    readonlyText: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.fg,
    },
    hoursRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 6,
    },
    timeCard: {
      flex: 1,
      height: 52,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.divider,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    timeCardLabel: {
      fontSize: 10.5,
      fontWeight: "700",
      color: theme.fgMuted,
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    timeCardValue: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.fg,
      paddingVertical: 0,
      marginTop: 1,
    },
    fuelLoading: {
      height: 80,
      alignItems: "center",
      justifyContent: "center",
    },
    fuelList: {
      marginTop: 4,
    },
    bankPicker: {
      minHeight: 56,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.divider,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    bankBrandTile: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.palette.green50,
      alignItems: "center",
      justifyContent: "center",
    },
    bankBrandText: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.palette.green700,
    },
    bankPickerText: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
    bankPickerSub: {
      fontSize: 12,
      color: theme.fgMuted,
      marginTop: 2,
    },
    resolveRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 4,
    },
    resolveText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "700",
    },
    resolveOk: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 14,
      borderRadius: 14,
      backgroundColor: theme.successTint,
      borderWidth: 1,
      borderColor: theme.success + "33",
    },
    resolveLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.success,
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    resolveName: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
      marginTop: 2,
    },
    resolveError: {
      ...theme.type.bodySm,
      color: theme.error,
      fontWeight: "700",
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
    skipBtn: {
      paddingVertical: 8,
      alignItems: "center",
    },
    skipText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "700",
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: theme.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 24,
      maxHeight: "85%",
    },
    modalHandle: {
      alignSelf: "center",
      width: 44,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      marginBottom: 12,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 4,
      marginBottom: 10,
    },
    modalTitle: {
      ...theme.type.h2,
      color: theme.fg,
      fontWeight: "800",
    },
    search: {
      ...theme.type.body,
      color: theme.fg,
      backgroundColor: theme.bgMuted,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 8,
    },
    modalRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 12,
    },
    modalRowText: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "600",
      flex: 1,
    },
    modalSep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
      marginHorizontal: 8,
    },
    modalEmpty: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      textAlign: "center",
      paddingVertical: 24,
    },
  });
