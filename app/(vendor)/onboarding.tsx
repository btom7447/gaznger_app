import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Modal, FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import MapView, { Marker, Region, PROVIDER_GOOGLE } from "react-native-maps";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { api } from "@/lib/api";

const TOTAL_STEPS = 5;

const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo",
  "Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa",
  "Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba",
  "Yobe","Zamfara",
];

interface FuelType { _id: string; name: string; unit: string }
interface FuelOffering { fuelId: string; name: string; unit: string; pricePerUnit: string; selected: boolean }

export default function VendorOnboarding() {
  const theme = useTheme();
  const { updateUser } = useSessionStore();
  const accessToken = useSessionStore((s) => s.accessToken);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 0 — Business info
  const [stationName, setStationName] = useState("");
  const [stationType, setStationType] = useState<"petrol_station" | "gas_plant" | "multi_fuel">("petrol_station");

  // Step 1 — Location
  const [address, setAddress] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [lga, setLga] = useState("");
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 6.5244, longitude: 3.3792, latitudeDelta: 0.01, longitudeDelta: 0.01,
  });
  const [pinCoords, setPinCoords] = useState({ lat: 6.5244, lng: 3.3792 });
  const [latInput, setLatInput] = useState("6.52440");
  const [lngInput, setLngInput] = useState("3.37920");
  const [locating, setLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [stateSearch, setStateSearch] = useState("");

  // Step 2 — Fuel offerings
  const [fuelOfferings, setFuelOfferings] = useState<FuelOffering[]>([]);
  const [loadingFuels, setLoadingFuels] = useState(false);

  // Step 3 — Station images
  const [stationImages, setStationImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Step 4 — Bank details
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  useEffect(() => {
    if (step === 2 && fuelOfferings.length === 0) fetchFuels();
    if (step === 1 && !mapReady) requestLocation();
  }, [step]);

  const requestLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocating(false); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      setPinCoords({ lat: latitude, lng: longitude });
      setMapRegion({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });
      setLatInput(latitude.toFixed(6));
      setLngInput(longitude.toFixed(6));
      reverseGeocode(latitude, longitude);
    } catch {
      // use default region
    } finally {
      setLocating(false);
      setMapReady(true);
    }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.streetNumber, r.street, r.district, r.city].filter(Boolean);
        if (parts.length > 0) setAddress(parts.join(", "));
        if (r.region) setStateVal(NIGERIAN_STATES.find((s) => r.region?.toLowerCase().includes(s.toLowerCase())) ?? "");
      }
    } catch {
      // geocode failed — leave address as-is
    }
  };

  const fetchFuels = async () => {
    setLoadingFuels(true);
    try {
      const data = await api.get<FuelType[]>("/api/fuel-types");
      setFuelOfferings(data.map((f) => ({ fuelId: f._id, name: f.name, unit: f.unit, pricePerUnit: "", selected: false })));
    } catch {
      toast.error("Could not load fuel types");
    } finally {
      setLoadingFuels(false);
    }
  };

  const toggleFuel = (fuelId: string) =>
    setFuelOfferings((p) => p.map((f) => f.fuelId === fuelId ? { ...f, selected: !f.selected } : f));

  const setFuelPrice = (fuelId: string, price: string) =>
    setFuelOfferings((p) => p.map((f) => f.fuelId === fuelId ? { ...f, pricePerUnit: price } : f));

  const pickImage = async () => {
    if (stationImages.length >= 5) { toast.info("Maximum 5 photos allowed"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.8,
    });
    if (result.canceled) return;
    setUploadingImage(true);
    try {
      const uri = result.assets[0].uri;
      const formData = new FormData();
      formData.append("image", { uri, name: "station.jpg", type: "image/jpeg" } as any);
      const res = await fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/api/upload/image`, {
        method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setStationImages((p) => [...p, data.url]);
    } catch (err: any) {
      toast.error("Image upload failed", { description: err.message });
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (url: string) => setStationImages((p) => p.filter((u) => u !== url));

  const canNext = [
    stationName.trim().length >= 3,
    address.trim().length > 0 && stateVal.length > 0 && lga.trim().length > 0,
    fuelOfferings.some((f) => f.selected && Number(f.pricePerUnit) > 0),
    stationImages.length > 0,
    bankName.trim().length > 0 && accountNumber.trim().length >= 10 && accountName.trim().length > 0,
  ][step];

  const handleFinish = async () => {
    setSaving(true);
    try {
      const selectedFuels = fuelOfferings
        .filter((f) => f.selected && Number(f.pricePerUnit) > 0)
        .map((f) => ({ fuel: f.fuelId, pricePerUnit: Number(f.pricePerUnit) }));
      await api.post("/api/vendor/onboard", {
        stationName: stationName.trim(), stationType,
        address: address.trim(), state: stateVal, lga: lga.trim(),
        location: { lat: pinCoords.lat, lng: pinCoords.lng },
        fuels: selectedFuels, images: stationImages,
        bankAccount: { bankName: bankName.trim(), accountNumber: accountNumber.trim(), accountName: accountName.trim() },
      });
      updateUser({ isOnboarded: true });
      toast.success("Station set up!", { description: "Welcome to Gaznger Vendor." });
      router.replace("/(vendor)/(dashboard)" as any);
    } catch (err: any) {
      toast.error("Setup failed", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const s = styles(theme);
  const filteredStates = NIGERIAN_STATES.filter((st) =>
    st.toLowerCase().includes(stateSearch.toLowerCase())
  );

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>

        {/* Top bar */}
        <View style={s.topBar}>
          {step > 0
            ? <TouchableOpacity onPress={() => setStep((v) => v - 1)} style={s.backBtn}>
                <Ionicons name="chevron-back" size={22} color={theme.text} />
              </TouchableOpacity>
            : <View style={s.backBtn} />
          }
          <View style={s.progressBarWrap}>
            <View style={[s.progressTrack, { backgroundColor: theme.ash }]}>
              <View style={[s.progressFill, { backgroundColor: theme.primary, width: `${((step + 1) / TOTAL_STEPS) * 100}%` }]} />
            </View>
            <Text style={[s.stepLabel, { color: theme.icon }]}>Step {step + 1} of {TOTAL_STEPS}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── STEP 0: Business Info ── */}
          {step === 0 && (
            <View style={s.slide}>
              <Text style={[s.heading, { color: theme.text }]}>Tell us about your station</Text>
              <Text style={[s.sub, { color: theme.icon }]}>This appears on the platform for customers to find you.</Text>
              <FieldGroup label="Station Name *">
                <TextInput
                  style={[s.input, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.surface }]}
                  value={stationName} onChangeText={setStationName}
                  placeholder="e.g. Sunrise Petroleum" placeholderTextColor={theme.icon}
                />
              </FieldGroup>
              <Text style={[s.fieldLabel, { color: theme.icon }]}>Station Type *</Text>
              <View style={s.typeRow}>
                {(["petrol_station", "gas_plant", "multi_fuel"] as const).map((t) => {
                  const labels = { petrol_station: "Petrol Station", gas_plant: "Gas Plant", multi_fuel: "Multi-Fuel" };
                  const icons = { petrol_station: "local-gas-station", gas_plant: "propane-tank", multi_fuel: "layers" } as const;
                  const active = stationType === t;
                  return (
                    <TouchableOpacity
                      key={t} onPress={() => setStationType(t)} activeOpacity={0.8}
                      style={[s.typeCard, {
                        borderColor: active ? theme.primary : theme.ash,
                        backgroundColor: active ? theme.tertiary : theme.surface,
                      }]}
                    >
                      <MaterialIcons name={icons[t]} size={30} color={active ? theme.primary : theme.icon} />
                      <Text style={[s.typeLabel, { color: active ? theme.primary : theme.icon }]}>{labels[t]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── STEP 1: Location with Map ── */}
          {step === 1 && (
            <View style={s.slide}>
              <Text style={[s.heading, { color: theme.text }]}>Where is your station?</Text>
              <Text style={[s.sub, { color: theme.icon }]}>Tap the map or drag the pin to set your exact location.</Text>

              {/* Map */}
              <View style={[s.mapContainer, { borderColor: theme.ash }]}>
                {!mapReady || locating ? (
                  <View style={[s.mapPlaceholder, { backgroundColor: theme.surface }]}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={[s.mapPlaceholderText, { color: theme.icon }]}>
                      {locating ? "Finding your location…" : "Loading map…"}
                    </Text>
                  </View>
                ) : (
                  <MapView
                    provider={PROVIDER_GOOGLE}
                    style={s.map}
                    region={mapRegion}
                    onRegionChangeComplete={(r) => setMapRegion(r)}
                    onPress={(e) => {
                      const { latitude, longitude } = e.nativeEvent.coordinate;
                      setPinCoords({ lat: latitude, lng: longitude });
                      setMapRegion((p) => ({ ...p, latitude, longitude }));
                      setLatInput(latitude.toFixed(6));
                      setLngInput(longitude.toFixed(6));
                      reverseGeocode(latitude, longitude);
                    }}
                    showsUserLocation
                    showsMyLocationButton={false}
                  >
                    <Marker
                      coordinate={{ latitude: pinCoords.lat, longitude: pinCoords.lng }}
                      draggable
                      onDragEnd={(e) => {
                        const { latitude, longitude } = e.nativeEvent.coordinate;
                        setPinCoords({ lat: latitude, lng: longitude });
                        setMapRegion((p) => ({ ...p, latitude, longitude }));
                        setLatInput(latitude.toFixed(6));
                        setLngInput(longitude.toFixed(6));
                        reverseGeocode(latitude, longitude);
                      }}
                    >
                      <View style={{ alignItems: "center" }}>
                        <View style={[s.pinBubble, { backgroundColor: theme.primary }]}>
                          <Ionicons name="location" size={16} color="#fff" />
                        </View>
                        <View style={[s.pinTail, { borderTopColor: theme.primary }]} />
                      </View>
                    </Marker>
                  </MapView>
                )}

                {/* Tooltip */}
                <View style={[s.mapTooltip, { backgroundColor: theme.background + "EE" }]} pointerEvents="none">
                  <Ionicons name="finger-print-outline" size={13} color={theme.icon} />
                  <Text style={[s.mapTooltipText, { color: theme.icon }]}>Tap map or drag the pin</Text>
                </View>

                {/* Coordinates overlay */}
                <View style={[s.mapOverlay, { backgroundColor: theme.background + "EE" }]} pointerEvents="none">
                  <Text style={[s.mapOverlayText, { color: theme.text }]}>
                    {pinCoords.lat.toFixed(5)}, {pinCoords.lng.toFixed(5)}
                  </Text>
                </View>

                {/* My location button */}
                <TouchableOpacity
                  style={[s.myLocationBtn, { backgroundColor: theme.background, borderColor: theme.ash }]}
                  onPress={requestLocation}
                  activeOpacity={0.8}
                >
                  <Ionicons name="locate-outline" size={18} color={theme.primary} />
                </TouchableOpacity>
              </View>

              {/* Lat / Lng inputs */}
              <View style={s.coordRow}>
                <View style={[s.inputWrapper, { borderColor: theme.ash, backgroundColor: theme.surface, flex: 1 }]}>
                  <Text style={[s.coordLabel, { color: theme.icon }]}>Lat</Text>
                  <TextInput
                    style={[s.inputText, { color: theme.text }]}
                    value={latInput}
                    onChangeText={(v) => {
                      setLatInput(v);
                      const n = parseFloat(v);
                      if (!isNaN(n)) {
                        setPinCoords((p) => ({ ...p, lat: n }));
                        setMapRegion((p) => ({ ...p, latitude: n }));
                      }
                    }}
                    keyboardType="decimal-pad"
                    placeholder="Latitude"
                    placeholderTextColor={theme.icon}
                  />
                </View>
                <View style={[s.inputWrapper, { borderColor: theme.ash, backgroundColor: theme.surface, flex: 1 }]}>
                  <Text style={[s.coordLabel, { color: theme.icon }]}>Lng</Text>
                  <TextInput
                    style={[s.inputText, { color: theme.text }]}
                    value={lngInput}
                    onChangeText={(v) => {
                      setLngInput(v);
                      const n = parseFloat(v);
                      if (!isNaN(n)) {
                        setPinCoords((p) => ({ ...p, lng: n }));
                        setMapRegion((p) => ({ ...p, longitude: n }));
                      }
                    }}
                    keyboardType="decimal-pad"
                    placeholder="Longitude"
                    placeholderTextColor={theme.icon}
                  />
                </View>
              </View>

              {/* Street address */}
              <Text style={[s.fieldLabel, { color: theme.icon }]}>Street Address *</Text>
              <View style={[s.inputWrapper, { borderColor: address ? theme.primary : theme.ash, backgroundColor: theme.surface, marginBottom: 16 }]}>
                <TextInput
                  style={[s.inputText, { color: theme.text }]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="e.g. 12 Adeola Odeku Street"
                  placeholderTextColor={theme.icon}
                />
              </View>

              {/* State dropdown */}
              <Text style={[s.fieldLabel, { color: theme.icon }]}>State *</Text>
              <TouchableOpacity
                style={[s.inputWrapper, { borderColor: stateVal ? theme.primary : theme.ash, backgroundColor: theme.surface, marginBottom: 16, justifyContent: "space-between" }]}
                onPress={() => setShowStatePicker(true)}
                activeOpacity={0.8}
              >
                <Text style={[s.inputText, { color: stateVal ? theme.text : theme.icon }]}>
                  {stateVal || "Select state…"}
                </Text>
                <Ionicons name="chevron-down" size={16} color={theme.icon} />
              </TouchableOpacity>

              {/* LGA */}
              <Text style={[s.fieldLabel, { color: theme.icon }]}>LGA *</Text>
              <View style={[s.inputWrapper, { borderColor: lga ? theme.primary : theme.ash, backgroundColor: theme.surface, marginBottom: 8 }]}>
                <TextInput
                  style={[s.inputText, { color: theme.text }]}
                  value={lga}
                  onChangeText={setLga}
                  placeholder="Local Government Area"
                  placeholderTextColor={theme.icon}
                />
              </View>
            </View>
          )}

          {/* ── STEP 2: Fuel Offerings ── */}
          {step === 2 && (
            <View style={s.slide}>
              <Text style={[s.heading, { color: theme.text }]}>What fuels do you sell?</Text>
              <Text style={[s.sub, { color: theme.icon }]}>Select each fuel type and set your price per unit.</Text>
              {loadingFuels ? (
                <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
              ) : (
                fuelOfferings.map((f) => (
                  <TouchableOpacity
                    key={f.fuelId} onPress={() => toggleFuel(f.fuelId)} activeOpacity={0.85}
                    style={[s.fuelCard, {
                      borderColor: f.selected ? theme.primary : theme.ash,
                      backgroundColor: f.selected ? theme.tertiary : theme.surface,
                    }]}
                  >
                    <View style={s.fuelCardTop}>
                      <View style={[s.fuelCheck, {
                        backgroundColor: f.selected ? theme.primary : "transparent",
                        borderColor: f.selected ? theme.primary : theme.ash,
                      }]}>
                        {f.selected && <Ionicons name="checkmark" size={13} color="#fff" />}
                      </View>
                      <Text style={[s.fuelName, { color: theme.text }]}>{f.name}</Text>
                      <Text style={[s.fuelUnit, { color: theme.icon }]}>per {f.unit}</Text>
                    </View>
                    {f.selected && (
                      <View style={[s.fuelPriceRow, { borderTopColor: theme.ash }]}>
                        <Text style={[s.fuelPriceLabel, { color: theme.icon }]}>₦ Price per {f.unit}</Text>
                        <TextInput
                          style={[s.fuelPriceInput, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.background }]}
                          value={f.pricePerUnit} onChangeText={(v) => setFuelPrice(f.fuelId, v)}
                          keyboardType="numeric" placeholder="0.00" placeholderTextColor={theme.icon}
                          onStartShouldSetResponder={() => true}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* ── STEP 3: Station Images ── */}
          {step === 3 && (
            <View style={s.slide}>
              <Text style={[s.heading, { color: theme.text }]}>Add station photos</Text>
              <Text style={[s.sub, { color: theme.icon }]}>
                Upload up to 5 photos. Clear photos build customer trust.
              </Text>

              {/* Scrollable preview row */}
              {stationImages.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={s.previewScroll}
                  contentContainerStyle={s.previewScrollContent}
                >
                  {stationImages.map((uri, idx) => (
                    <View key={uri} style={s.previewThumbWrap}>
                      <Image source={{ uri }} style={s.previewThumb} resizeMode="cover" />
                      {idx === 0 && (
                        <View style={[s.coverBadge, { backgroundColor: theme.primary }]}>
                          <Ionicons name="star" size={10} color="#fff" />
                          <Text style={s.coverBadgeText}>Cover</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={s.removeThumb}
                        onPress={() => removeImage(uri)}
                        activeOpacity={0.8}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Cover photo hint */}
              {stationImages.length > 0 && (
                <View style={[s.coverHint, { backgroundColor: theme.tertiary }]}>
                  <Ionicons name="information-circle-outline" size={14} color={theme.primary} />
                  <Text style={[s.coverHintText, { color: theme.icon }]}>
                    The first photo is used as the cover image on search and map results.
                  </Text>
                </View>
              )}

              {/* Upload button */}
              {stationImages.length < 5 && (
                <TouchableOpacity
                  style={[s.photoUploadBtn, { borderColor: theme.ash }]}
                  onPress={pickImage}
                  disabled={uploadingImage}
                  activeOpacity={0.8}
                >
                  {uploadingImage
                    ? <ActivityIndicator size="small" color={theme.primary} />
                    : <>
                        <Ionicons name="cloud-upload-outline" size={26} color={theme.primary} />
                        <Text style={[s.photoUploadBtnText, { color: theme.primary }]}>
                          {stationImages.length === 0 ? "Upload station photos" : "Add another photo"}
                        </Text>
                        <Text style={[s.photoUploadHint, { color: theme.icon }]}>
                          {stationImages.length}/5 photos · JPG or PNG, max 5MB
                        </Text>
                      </>
                  }
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── STEP 4: Bank Details ── */}
          {step === 4 && (
            <View style={s.slide}>
              <Text style={[s.heading, { color: theme.text }]}>Payout details</Text>
              <Text style={[s.sub, { color: theme.icon }]}>
                Your earnings will be paid to this account. You can update this later from your profile.
              </Text>
              <FieldGroup label="Bank Name *">
                <TextInput
                  style={[s.input, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.surface }]}
                  value={bankName} onChangeText={setBankName}
                  placeholder="e.g. First Bank, GTBank" placeholderTextColor={theme.icon}
                />
              </FieldGroup>
              <FieldGroup label="Account Number *">
                <TextInput
                  style={[s.input, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.surface }]}
                  value={accountNumber} onChangeText={setAccountNumber}
                  keyboardType="numeric" maxLength={10}
                  placeholder="10-digit account number" placeholderTextColor={theme.icon}
                />
              </FieldGroup>
              <FieldGroup label="Account Name *">
                <TextInput
                  style={[s.input, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.surface }]}
                  value={accountName} onChangeText={setAccountName}
                  placeholder="Name on your bank account" placeholderTextColor={theme.icon}
                  autoCapitalize="words"
                />
              </FieldGroup>
              <View style={[s.noticeBanner, { backgroundColor: theme.tertiary }]}>
                <Ionicons name="lock-closed-outline" size={14} color={theme.primary} />
                <Text style={[s.noticeText, { color: theme.icon }]}>
                  Your bank details are encrypted and only used for payouts.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[s.footer, { borderTopColor: theme.ash }]}>
          <View style={s.dots}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View key={i} style={[s.dot, { backgroundColor: i <= step ? theme.primary : theme.ash, width: i === step ? 24 : 8 }]} />
            ))}
          </View>
          <TouchableOpacity
            onPress={step < TOTAL_STEPS - 1 ? () => setStep((v) => v + 1) : handleFinish}
            disabled={!canNext || saving}
            style={[s.nextBtn, { backgroundColor: canNext ? theme.primary : theme.primary + "40" }]}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.nextBtnText}>{step < TOTAL_STEPS - 1 ? "Continue" : "Launch My Station"}</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* State Picker Modal */}
      <Modal visible={showStatePicker} animationType="slide" transparent onRequestClose={() => setShowStatePicker(false)}>
        <View style={s.modalOverlay}>
          <SafeAreaView style={[s.modalSheet, { backgroundColor: theme.background }]}>
            <View style={[s.modalHeader, { borderBottomColor: theme.ash }]}>
              <Text style={[s.modalTitle, { color: theme.text }]}>Select State</Text>
              <TouchableOpacity onPress={() => setShowStatePicker(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={theme.icon} />
              </TouchableOpacity>
            </View>
            <View style={[s.searchWrap, { borderColor: theme.ash, backgroundColor: theme.surface }]}>
              <Ionicons name="search-outline" size={16} color={theme.icon} />
              <TextInput
                style={[s.searchInput, { color: theme.text }]}
                placeholder="Search states…" placeholderTextColor={theme.icon}
                value={stateSearch} onChangeText={setStateSearch}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredStates}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const active = stateVal === item;
                return (
                  <TouchableOpacity
                    style={[s.stateItem, { borderBottomColor: theme.ash }]}
                    onPress={() => { setStateVal(item); setStateSearch(""); setShowStatePicker(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.stateItemText, { color: active ? theme.primary : theme.text }]}>{item}</Text>
                    {active && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 13, color: theme.icon, marginBottom: 6, fontWeight: "500" }}>{label}</Text>
      {children}
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, gap: 12 },
    backBtn: { width: 36, height: 36, justifyContent: "center" },
    progressBarWrap: { flex: 1, gap: 5 },
    progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
    progressFill: { height: 4, borderRadius: 2 },
    stepLabel: { fontSize: 11, fontWeight: "400" },

    scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 16 },
    slide: { paddingTop: 10 },
    heading: { fontSize: 24, fontWeight: "700", marginBottom: 6, marginTop: 4 },
    sub: { fontSize: 14, lineHeight: 21, marginBottom: 24 },
    fieldLabel: { fontSize: 13, fontWeight: "500", marginBottom: 8 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },

    typeRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
    typeCard: {
      flex: 1, alignItems: "center", gap: 8, paddingVertical: 16,
      borderRadius: 14, borderWidth: 1.5,
    },
    typeLabel: { fontSize: 11, fontWeight: "500", textAlign: "center" },

    // Map
    mapContainer: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 8, height: 240 },
    map: { flex: 1 },
    mapPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
    mapPlaceholderText: { fontSize: 13 },
    myLocationBtn: {
      position: "absolute", bottom: 10, right: 10,
      width: 38, height: 38, borderRadius: 10, borderWidth: 1,
      alignItems: "center", justifyContent: "center",
    },
    coordHint: { fontSize: 11, marginBottom: 14, textAlign: "center" },

    // Address-book style inputs
    inputWrapper: {
      flexDirection: "row", alignItems: "center",
      borderWidth: 1.5, borderRadius: 14, height: 54,
      paddingHorizontal: 14, gap: 8,
    },
    inputText: { flex: 1, fontSize: 16, fontWeight: "300" },
    coordRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
    coordLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },

    // Custom map pin — exact address-book dimensions
    pinBubble: {
      width: 36, height: 36, borderRadius: 10,
      justifyContent: "center", alignItems: "center",
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25, shadowRadius: 4, elevation: 4,
    },
    pinTail: {
      width: 0, height: 0,
      borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
      borderLeftColor: "transparent", borderRightColor: "transparent",
    },

    // Map overlays — exact address-book style
    mapTooltip: {
      position: "absolute", top: 10, alignSelf: "center",
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
    },
    mapTooltipText: { fontSize: 11, fontWeight: "400" },
    mapOverlay: {
      position: "absolute", bottom: 10, alignSelf: "center",
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
    },
    mapOverlayText: { fontSize: 11, fontWeight: "400" },

    pickerBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
      marginBottom: 16,
    },
    pickerBtnText: { fontSize: 15 },

    fuelCard: { borderWidth: 1.5, borderRadius: 14, marginBottom: 10, overflow: "hidden" },
    fuelCardTop: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
    fuelCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
    fuelName: { flex: 1, fontSize: 15, fontWeight: "500" },
    fuelUnit: { fontSize: 12 },
    fuelPriceRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 12, borderTopWidth: 1 },
    fuelPriceLabel: { fontSize: 13, flex: 1 },
    fuelPriceInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, width: 120, textAlign: "right" },

    // Photos — scrollable preview + single upload button
    previewScroll: { marginBottom: 12 },
    previewScrollContent: { gap: 10, paddingRight: 4 },
    previewThumbWrap: { width: 110, height: 84, borderRadius: 12, overflow: "hidden", position: "relative" },
    previewThumb: { width: "100%", height: "100%" },
    coverBadge: {
      position: "absolute", bottom: 6, left: 6,
      flexDirection: "row", alignItems: "center", gap: 3,
      paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
    },
    coverBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
    removeThumb: { position: "absolute", top: 4, right: 4 },
    coverHint: {
      flexDirection: "row", alignItems: "flex-start", gap: 8,
      padding: 12, borderRadius: 12, marginBottom: 14,
    },
    coverHintText: { flex: 1, fontSize: 12, lineHeight: 17 },
    photoUploadBtn: { borderWidth: 1.5, borderStyle: "dashed", borderRadius: 16, paddingVertical: 32, alignItems: "center", gap: 8 },
    photoUploadBtnText: { fontSize: 15, fontWeight: "600" },
    photoUploadHint: { fontSize: 12 },

    noticeBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, marginTop: 4 },
    noticeText: { fontSize: 12, lineHeight: 18, flex: 1 },

    footer: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 12, gap: 14, borderTopWidth: StyleSheet.hairlineWidth },
    dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
    dot: { height: 8, borderRadius: 4 },
    nextBtn: { paddingVertical: 15, borderRadius: 14, alignItems: "center" },
    nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },

    // State picker modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%", paddingBottom: 20 },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
    modalTitle: { fontSize: 17, fontWeight: "700" },
    searchWrap: {
      flexDirection: "row", alignItems: "center", gap: 8,
      borderWidth: 1, borderRadius: 12, marginHorizontal: 16, marginVertical: 10,
      paddingHorizontal: 12, paddingVertical: 10,
    },
    searchInput: { flex: 1, fontSize: 15 },
    stateItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
    stateItemText: { fontSize: 15 },
  });
