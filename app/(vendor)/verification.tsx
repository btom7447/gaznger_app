import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { api } from "@/lib/api";

const TOTAL_STEPS = 4;

interface DocUpload {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  url: string | null;
  uploading: boolean;
}

function VerificationSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const bg = theme.ash;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Progress bar area */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 8 }}>
        <Animated.View style={{ height: 4, borderRadius: 2, backgroundColor: bg, opacity: anim }} />
        <Animated.View style={{ width: 80, height: 11, borderRadius: 5, backgroundColor: bg, opacity: anim, alignSelf: "flex-end" }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
        {/* Heading */}
        <Animated.View style={{ width: "60%", height: 28, borderRadius: 8, backgroundColor: bg, opacity: anim }} />
        <Animated.View style={{ width: "85%", height: 14, borderRadius: 6, backgroundColor: bg, opacity: anim }} />
        {/* Doc cards */}
        {[0,1,2].map((i) => (
          <View key={i} style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.ash, backgroundColor: theme.surface, padding: 14, gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Animated.View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: bg, opacity: anim }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Animated.View style={{ width: "55%", height: 13, borderRadius: 5, backgroundColor: bg, opacity: anim }} />
                <Animated.View style={{ width: "80%", height: 11, borderRadius: 5, backgroundColor: bg, opacity: anim }} />
              </View>
            </View>
            <Animated.View style={{ height: 80, borderRadius: 10, backgroundColor: bg, opacity: anim }} />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function VendorVerification() {
  const theme = useTheme();
  const accessToken = useSessionStore((s) => s.accessToken);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingStatus, setExistingStatus] = useState<"none" | "pending" | "verified" | "rejected" | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    api.get<{ user: { vendorVerification?: { status: string } } }>("/api/vendor/profile")
      .then((data) => {
        const status = (data.user?.vendorVerification?.status ?? "none") as typeof existingStatus;
        setExistingStatus(status);
      })
      .catch(() => setExistingStatus("none"))
      .finally(() => setCheckingStatus(false));
  }, []);

  const [docs, setDocs] = useState<DocUpload[]>([
    { label: "CAC Certificate", description: "Corporate Affairs Commission registration document", icon: "document-text-outline", url: null, uploading: false },
    { label: "Tax Identification Number (TIN)", description: "Federal Inland Revenue Service TIN document", icon: "receipt-outline", url: null, uploading: false },
    { label: "Director's ID", description: "Government-issued ID of the business owner or director", icon: "card-outline", url: null, uploading: false },
  ]);

  const uploadDoc = async (idx: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, quality: 0.9,
    });
    if (result.canceled) return;

    setDocs((prev) => prev.map((d, i) => i === idx ? { ...d, uploading: true } : d));
    try {
      const uri = result.assets[0].uri;
      const formData = new FormData();
      formData.append("image", { uri, name: "doc.jpg", type: "image/jpeg" } as any);
      const res = await fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/api/upload/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setDocs((prev) => prev.map((d, i) => i === idx ? { ...d, url: data.url, uploading: false } : d));
      toast.success("Document uploaded");
    } catch (err: any) {
      toast.error("Upload failed", { description: err.message });
      setDocs((prev) => prev.map((d, i) => i === idx ? { ...d, uploading: false } : d));
    }
  };

  const removeDoc = (idx: number) => {
    setDocs((prev) => prev.map((d, i) => i === idx ? { ...d, url: null } : d));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post("/api/vendor/verification/submit", {
        documents: docs.map((d) => ({ label: d.label, url: d.url })),
      });
      setSubmitted(true);
    } catch (err: any) {
      toast.error("Submission failed", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const canNext = [
    true,                         // Step 0: intro — always passable
    docs[0].url !== null,         // Step 1: CAC
    docs[1].url !== null && docs[2].url !== null, // Step 2: TIN + Director ID
    true,                         // Step 3: review
  ][step];

  const s = styles(theme);

  if (checkingStatus) return <VerificationSkeleton theme={theme} />;

  // ── Already verified ──
  if (existingStatus === "verified") {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <View style={[s.successIcon, { backgroundColor: "#22C55E18" }]}>
            <MaterialIcons name="verified" size={52} color="#22C55E" />
          </View>
          <Text style={[s.successTitle, { color: theme.text }]}>Business Verified</Text>
          <Text style={[s.successSub, { color: theme.icon }]}>
            Your business is verified on Gaznger. You have access to all verified vendor benefits.
          </Text>
          <TouchableOpacity
            style={[s.doneBtn, { backgroundColor: theme.primary }]}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text style={s.doneBtnText}>Back to Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Already submitted / pending review ──
  if (existingStatus === "pending" && !submitted) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={[s.topBar, { paddingBottom: 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { borderColor: theme.ash }]}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[s.topTitle, { color: theme.text }]}>Verification Status</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.center}>
          <View style={[s.successIcon, { backgroundColor: "#F59E0B18" }]}>
            <Ionicons name="time-outline" size={48} color="#F59E0B" />
          </View>
          <Text style={[s.successTitle, { color: theme.text }]}>Under Review</Text>
          <Text style={[s.successSub, { color: theme.icon }]}>
            Your documents are being reviewed. Our team will notify you within 2–5 business days.
          </Text>
          <View style={[s.timelineCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            {[
              { label: "Documents received", done: true },
              { label: "Under review by team", done: true },
              { label: "Verification decision", done: false },
              { label: "Badge awarded", done: false },
            ].map((item, i) => (
              <View key={i} style={s.timelineRow}>
                <View style={[s.timelineDot, { backgroundColor: item.done ? "#F59E0B" : theme.ash }]}>
                  {item.done && <Ionicons name="checkmark" size={10} color="#fff" />}
                </View>
                {i < 3 && <View style={[s.timelineLine, { backgroundColor: theme.ash }]} />}
                <Text style={[s.timelineLabel, { color: item.done ? theme.text : theme.icon }]}>{item.label}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[s.doneBtn, { backgroundColor: theme.primary }]}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text style={s.doneBtnText}>Back to Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Submitted / Pending State ──
  if (submitted) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <View style={[s.successIcon, { backgroundColor: "#22C55E18" }]}>
            <MaterialIcons name="verified" size={52} color="#22C55E" />
          </View>
          <Text style={[s.successTitle, { color: theme.text }]}>Documents Submitted</Text>
          <Text style={[s.successSub, { color: theme.icon }]}>
            Our team will review your documents within 2–5 business days. You'll receive a notification once verified.
          </Text>
          <View style={[s.timelineCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            {[
              { label: "Documents received", done: true },
              { label: "Under review by team", done: false },
              { label: "Verification decision", done: false },
              { label: "Badge awarded", done: false },
            ].map((item, i) => (
              <View key={i} style={s.timelineRow}>
                <View style={[s.timelineDot, { backgroundColor: item.done ? "#22C55E" : theme.ash }]}>
                  {item.done && <Ionicons name="checkmark" size={10} color="#fff" />}
                </View>
                {i < 3 && <View style={[s.timelineLine, { backgroundColor: theme.ash }]} />}
                <Text style={[s.timelineLabel, { color: item.done ? theme.text : theme.icon }]}>{item.label}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[s.doneBtn, { backgroundColor: theme.primary }]}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text style={s.doneBtnText}>Back to Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Top bar */}
        <View style={s.topBar}>
          {step > 0 ? (
            <TouchableOpacity onPress={() => setStep((v) => v - 1)} style={[s.backBtn, { borderColor: theme.ash }]}>
              <Ionicons name="chevron-back" size={20} color={theme.text} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { borderColor: theme.ash }]}>
              <Ionicons name="chevron-back" size={20} color={theme.text} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[s.topTitle, { color: theme.text }]}>Get Verified</Text>
          </View>
          <Text style={[s.stepCount, { color: theme.icon }]}>{step + 1}/{TOTAL_STEPS}</Text>
        </View>

        {/* Progress bar */}
        <View style={[s.progressTrack, { backgroundColor: theme.ash }]}>
          <View style={[s.progressFill, { backgroundColor: theme.primary, width: `${((step + 1) / TOTAL_STEPS) * 100}%` }]} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* ── STEP 0: Introduction ── */}
          {step === 0 && (
            <View style={s.slide}>
              <View style={[s.heroBadge, { backgroundColor: "#22C55E18" }]}>
                <MaterialIcons name="verified" size={40} color="#22C55E" />
              </View>
              <Text style={[s.heading, { color: theme.text }]}>Verify Your Business</Text>
              <Text style={[s.sub, { color: theme.icon }]}>
                Verified vendors earn customer trust, appear higher in searches, and unlock priority platform features.
              </Text>
              <View style={[s.benefitsCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
                <Text style={[s.benefitsTitle, { color: theme.text }]}>What you get</Text>
                {[
                  { icon: "verified" as const, label: "Verified badge on your station profile" },
                  { icon: "trending-up" as const, label: "Higher ranking in customer search results" },
                  { icon: "star" as const, label: "Eligible for Gaznger Partner status" },
                  { icon: "notifications" as const, label: "Priority customer notifications" },
                ].map((b, i) => (
                  <View key={i} style={s.benefitRow}>
                    <View style={[s.benefitIcon, { backgroundColor: "#22C55E18" }]}>
                      <MaterialIcons name={b.icon} size={16} color="#22C55E" />
                    </View>
                    <Text style={[s.benefitLabel, { color: theme.text }]}>{b.label}</Text>
                  </View>
                ))}
              </View>
              <View style={[s.requirementsCard, { backgroundColor: theme.tertiary, borderColor: theme.ash }]}>
                <Ionicons name="information-circle-outline" size={16} color={theme.primary} />
                <Text style={[s.requirementsText, { color: theme.icon }]}>
                  You'll need: CAC Certificate, TIN document, and a government-issued ID for the business director.
                </Text>
              </View>
            </View>
          )}

          {/* ── STEP 1: CAC Certificate ── */}
          {step === 1 && (
            <View style={s.slide}>
              <Text style={[s.heading, { color: theme.text }]}>Business Registration</Text>
              <Text style={[s.sub, { color: theme.icon }]}>Upload your CAC (Corporate Affairs Commission) certificate of incorporation.</Text>
              <DocCard doc={docs[0]} idx={0} onUpload={uploadDoc} onRemove={removeDoc} theme={theme} />
            </View>
          )}

          {/* ── STEP 2: TIN + Director ID ── */}
          {step === 2 && (
            <View style={s.slide}>
              <Text style={[s.heading, { color: theme.text }]}>Tax & Identity</Text>
              <Text style={[s.sub, { color: theme.icon }]}>Upload your TIN document and a valid ID for the business director or owner.</Text>
              <DocCard doc={docs[1]} idx={1} onUpload={uploadDoc} onRemove={removeDoc} theme={theme} />
              <DocCard doc={docs[2]} idx={2} onUpload={uploadDoc} onRemove={removeDoc} theme={theme} />
            </View>
          )}

          {/* ── STEP 3: Review & Submit ── */}
          {step === 3 && (
            <View style={s.slide}>
              <Text style={[s.heading, { color: theme.text }]}>Review & Submit</Text>
              <Text style={[s.sub, { color: theme.icon }]}>Review your uploaded documents before submitting for verification.</Text>
              {docs.map((doc, i) => (
                <View key={i} style={[s.reviewRow, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
                  <View style={[s.reviewIcon, { backgroundColor: doc.url ? "#22C55E18" : theme.tertiary }]}>
                    <Ionicons name={doc.url ? "checkmark-circle" : "close-circle"} size={20} color={doc.url ? "#22C55E" : theme.icon} />
                  </View>
                  <Text style={[s.reviewLabel, { color: theme.text }]}>{doc.label}</Text>
                  <Text style={[s.reviewStatus, { color: doc.url ? "#22C55E" : theme.icon }]}>
                    {doc.url ? "Uploaded" : "Missing"}
                  </Text>
                </View>
              ))}
              <View style={[s.requirementsCard, { backgroundColor: "#F59E0B11", borderColor: "#F59E0B44" }]}>
                <Ionicons name="alert-circle-outline" size={16} color="#F59E0B" />
                <Text style={[s.requirementsText, { color: theme.icon }]}>
                  By submitting, you confirm all documents are authentic. False submissions may result in account suspension.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[s.footer, { borderTopColor: theme.ash }]}>
          <View style={s.dots}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View key={i} style={[s.dot, {
                backgroundColor: i <= step ? theme.primary : theme.ash,
                width: i === step ? 24 : 8,
              }]} />
            ))}
          </View>
          <TouchableOpacity
            onPress={step < TOTAL_STEPS - 1 ? () => setStep((v) => v + 1) : handleSubmit}
            disabled={!canNext || submitting}
            style={[s.nextBtn, { backgroundColor: canNext ? theme.primary : theme.primary + "40" }]}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.nextBtnText}>{step < TOTAL_STEPS - 1 ? "Continue" : "Submit for Verification"}</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DocCard({ doc, idx, onUpload, onRemove, theme }: {
  doc: DocUpload; idx: number;
  onUpload: (i: number) => void; onRemove: (i: number) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const s = styles(theme);
  return (
    <View style={[s.docCard, { backgroundColor: theme.surface, borderColor: doc.url ? "#22C55E66" : theme.ash }]}>
      <View style={s.docCardTop}>
        <View style={[s.docIcon, { backgroundColor: theme.tertiary }]}>
          <Ionicons name={doc.icon} size={22} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.docLabel, { color: theme.text }]}>{doc.label}</Text>
          <Text style={[s.docDesc, { color: theme.icon }]}>{doc.description}</Text>
        </View>
        {doc.url && (
          <TouchableOpacity onPress={() => onRemove(idx)} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={20} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
      {doc.url ? (
        <View style={[s.docPreview, { borderColor: theme.ash }]}>
          <Image source={{ uri: doc.url }} style={s.docImage} resizeMode="cover" />
          <View style={[s.docUploadedBadge, { backgroundColor: "#22C55E" }]}>
            <Ionicons name="checkmark" size={12} color="#fff" />
            <Text style={s.docUploadedText}>Uploaded</Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[s.docUploadBtn, { borderColor: theme.ash }]}
          onPress={() => onUpload(idx)}
          disabled={doc.uploading}
          activeOpacity={0.8}
        >
          {doc.uploading
            ? <ActivityIndicator size="small" color={theme.primary} />
            : <>
                <Ionicons name="cloud-upload-outline" size={22} color={theme.primary} />
                <Text style={[s.docUploadBtnText, { color: theme.primary }]}>Tap to upload</Text>
                <Text style={[s.docUploadHint, { color: theme.icon }]}>JPG or PNG, max 10MB</Text>
              </>
          }
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 16 },
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
    backBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    topTitle: { fontSize: 16, fontWeight: "600" },
    stepCount: { fontSize: 13, minWidth: 36, textAlign: "right" },
    progressTrack: { height: 3, marginHorizontal: 16, borderRadius: 2, marginBottom: 4 },
    progressFill: { height: 3, borderRadius: 2 },

    scroll: { paddingHorizontal: 20, paddingBottom: 16 },
    slide: { paddingTop: 12, gap: 0 },

    heroBadge: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 20, marginTop: 8 },
    heading: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
    sub: { fontSize: 14, lineHeight: 22, marginBottom: 24 },

    benefitsCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12, marginBottom: 14 },
    benefitsTitle: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
    benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    benefitIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    benefitLabel: { fontSize: 13, flex: 1 },

    requirementsCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
    requirementsText: { fontSize: 12, lineHeight: 18, flex: 1 },

    docCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14, gap: 12 },
    docCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    docIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    docLabel: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
    docDesc: { fontSize: 12, lineHeight: 17 },
    docPreview: { borderRadius: 10, overflow: "hidden", borderWidth: 1, height: 140 },
    docImage: { width: "100%", height: "100%", borderRadius: 10 },
    docUploadedBadge: { position: "absolute", bottom: 8, right: 8, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    docUploadedText: { fontSize: 11, fontWeight: "700", color: "#fff" },
    docUploadBtn: { borderWidth: 1.5, borderStyle: "dashed", borderRadius: 12, paddingVertical: 24, alignItems: "center", gap: 6 },
    docUploadBtnText: { fontSize: 14, fontWeight: "600" },
    docUploadHint: { fontSize: 11 },

    reviewRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
    reviewIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    reviewLabel: { flex: 1, fontSize: 14, fontWeight: "500" },
    reviewStatus: { fontSize: 12, fontWeight: "600" },

    footer: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 12, gap: 14, borderTopWidth: StyleSheet.hairlineWidth },
    dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
    dot: { height: 8, borderRadius: 4 },
    nextBtn: { paddingVertical: 15, borderRadius: 14, alignItems: "center" },
    nextBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

    // Success state
    successIcon: { width: 100, height: 100, borderRadius: 30, alignItems: "center", justifyContent: "center" },
    successTitle: { fontSize: 22, fontWeight: "700", textAlign: "center" },
    successSub: { fontSize: 14, lineHeight: 22, textAlign: "center" },
    timelineCard: { width: "100%", borderRadius: 16, borderWidth: 1, padding: 16, gap: 0 },
    timelineRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
    timelineDot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    timelineLine: { position: "absolute", left: 10, top: 30, width: 2, height: 16 },
    timelineLabel: { fontSize: 13 },
    doneBtn: { width: "100%", paddingVertical: 15, borderRadius: 14, alignItems: "center" },
    doneBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  });
