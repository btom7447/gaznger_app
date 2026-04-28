import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
  StatusBar,
  ScrollView,
  Keyboard,
  Dimensions,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { ADDRESS_ICONS } from "@/constants/addressIcons";
import { api } from "@/lib/api";
import { useSessionStore } from "@/store/useSessionStore";
import BackButton from "@/components/ui/global/BackButton";
import AddressListSkeleton from "@/components/ui/skeletons/AddressListSkeleton";
import { useUserLocation } from "@/hooks/useUserLocation";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.9;
const SLIDE_HEIGHT = MODAL_HEIGHT - 80; // subtract handle (18px) + modal header (~62px)

// Icon grid: 5 rows, scrollable horizontally
const ICON_CELL_SIZE = 52;
const CELL_GAP = 6;
const ICON_ROWS = 5;
const ICON_GRID_HEIGHT = ICON_ROWS * ICON_CELL_SIZE + (ICON_ROWS - 1) * CELL_GAP;

interface Address {
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

const DEFAULT_REGION: Region = {
  latitude: 6.5244,
  longitude: 3.3792,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function AddressBookScreen() {
  const theme = useTheme();
  const updateUser = useSessionStore((s) => s.updateUser);
  const { location: userLocation } = useUserLocation();
  const s = styles(theme);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /* Modal */
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [slide, setSlide] = useState(0);
  const slideRef = useRef<ScrollView>(null);

  /* Form */
  const [label, setLabel] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [icon, setIcon] = useState("home-outline");
  const [pinLat, setPinLat] = useState<number | null>(null);
  const [pinLng, setPinLng] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [isDefaultToggle, setIsDefaultToggle] = useState(false);

  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<MapView>(null);

  /* ── Data ── */
  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Address[]>("/api/address-book");
      setAddresses(data);
    } catch (err: any) {
      toast.error("Failed to load addresses", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAddresses(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAddresses();
    setRefreshing(false);
  };

  /* ── Form helpers ── */
  const resetForm = () => {
    setLabel(""); setStreet(""); setCity(""); setAddressState("");
    setIcon("home-outline"); setPinLat(null); setPinLng(null);
    setGeocoding(false); setIsDefaultToggle(false); setEditingId(null);
  };

  const closeModal = () => {
    setShowModal(false);
    setSlide(0);
    slideRef.current?.scrollTo({ x: 0, animated: false });
    resetForm();
  };

  const openAdd = () => {
    resetForm();
    if (userLocation) { setPinLat(userLocation.lat); setPinLng(userLocation.lng); }
    setShowModal(true);
  };

  const openEdit = (addr: Address) => {
    setEditingId(addr._id);
    setLabel(addr.label ?? "");
    setStreet(addr.street ?? "");
    setCity(addr.city ?? "");
    setAddressState(addr.state ?? "");
    setIcon(addr.icon ?? "home-outline");
    setPinLat(addr.latitude ?? userLocation?.lat ?? null);
    setPinLng(addr.longitude ?? userLocation?.lng ?? null);
    setIsDefaultToggle(addr.isDefault ?? false);
    setGeocoding(false);
    setShowModal(true);
  };

  const goToSlide = (n: number) => {
    slideRef.current?.scrollTo({ x: n * SCREEN_WIDTH, animated: true });
    setSlide(n);
  };

  /* ── Reverse geocode ── */
  const reverseGeocode = async (lat: number, lng: number) => {
    setGeocoding(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results[0]) {
        const r = results[0];
        setStreet([r.streetNumber, r.street].filter(Boolean).join(" ") || r.name || "");
        setCity(r.city || r.subregion || "");
        setAddressState(r.region || "");
      }
    } catch {
      // silent — user can type manually
    } finally {
      setGeocoding(false);
    }
  };

  const handleMapPress = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPinLat(latitude);
    setPinLng(longitude);
    reverseGeocode(latitude, longitude);
  };

  const handleDragEnd = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPinLat(latitude);
    setPinLng(longitude);
    reverseGeocode(latitude, longitude);
  };

  /* ── Save / Delete / Default ── */
  const saveAddress = async () => {
    if (!label.trim()) { toast.error("Label is required"); return; }
    setSaving(true);
    try {
      const payload = {
        label: label.trim(), street, city,
        state: addressState, icon,
        latitude: pinLat ?? 0,
        longitude: pinLng ?? 0,
      };

      let savedId: string;
      if (editingId) {
        const updated = await api.patch<Address>(`/api/address-book/${editingId}`, payload);
        savedId = editingId;
        setAddresses((prev) => prev.map((a) => (a._id === editingId ? { ...a, ...updated } : a)));
        toast.success("Address updated");
      } else {
        const data = await api.post<Address>("/api/address-book", payload);
        savedId = data._id;
        setAddresses((prev) => [data, ...prev]);
        toast.success("Address added");
      }

      if (isDefaultToggle) {
        await api.patch(`/api/address-book/default/${savedId}`, {});
        setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a._id === savedId })));
        updateUser({ defaultAddress: savedId });
      }

      closeModal();
    } catch (err: any) {
      toast.error(editingId ? "Failed to update" : "Failed to add", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const deleteAddress = async (id: string) => {
    try {
      await api.delete(`/api/address-book/${id}`);
      setAddresses((prev) => prev.filter((a) => a._id !== id));
      toast.success("Address removed");
    } catch (err: any) {
      toast.error("Failed to delete", { description: err.message });
    }
  };

  const setDefault = async (id: string) => {
    try {
      await api.patch(`/api/address-book/default/${id}`, {});
      setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a._id === id })));
      updateUser({ defaultAddress: id });
    } catch (err: any) {
      toast.error("Failed", { description: err.message });
    }
  };

  /* ── Map region ── */
  const mapRegion: Region = pinLat && pinLng
    ? { latitude: pinLat, longitude: pinLng, latitudeDelta: 0.008, longitudeDelta: 0.008 }
    : userLocation
    ? { latitude: userLocation.lat, longitude: userLocation.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : DEFAULT_REGION;

  /* ── Address list card ── */
  const renderItem = ({ item }: { item: Address }) => (
    <View style={[s.card, { borderColor: item.isDefault ? theme.primary : theme.ash, backgroundColor: theme.surface }]}>
      <View style={[s.cardIconWrap, { backgroundColor: item.isDefault ? theme.tertiary : theme.quinest }]}>
        <Ionicons
          name={(item.icon ?? "location-outline") as any}
          size={20}
          color={item.isDefault ? theme.primary : theme.icon}
        />
      </View>

      <TouchableOpacity style={s.cardContent} onPress={() => setDefault(item._id)} activeOpacity={0.7}>
        <View style={s.cardTitleRow}>
          <Text style={[s.cardLabel, { color: theme.text }]}>{item.label}</Text>
          {item.isDefault && (
            <View style={[s.defaultBadge, { backgroundColor: theme.tertiary, borderColor: theme.primary }]}>
              <Ionicons name="checkmark-circle" size={11} color={theme.primary} />
              <Text style={[s.defaultBadgeText, { color: theme.primary }]}>Default</Text>
            </View>
          )}
        </View>
        {(item.street || item.city) ? (
          <Text style={[s.cardSub, { color: theme.icon }]} numberOfLines={1}>
            {[item.street, item.city, item.state].filter(Boolean).join(", ")}
          </Text>
        ) : null}
        {item.latitude && item.longitude ? (
          <Text style={[s.cardCoords, { color: theme.icon }]}>
            {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
          </Text>
        ) : null}
      </TouchableOpacity>

      <View style={s.cardActions}>
        <TouchableOpacity onPress={() => openEdit(item)} style={s.actionBtn}>
          <Ionicons name="create-outline" size={17} color={theme.icon} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deleteAddress(item._id)} style={s.actionBtn}>
          <Ionicons name="trash-outline" size={17} color={theme.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />

      <View style={s.header}>
        <BackButton />
        <Text style={[s.headerTitle, { color: theme.text }]}>Address Book</Text>
        <TouchableOpacity
          style={[s.addIconBtn, { backgroundColor: theme.tertiary, borderColor: theme.ash }]}
          onPress={openAdd}
        >
          <Ionicons name="add" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={addresses}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingTop: 4 }}>
              <AddressListSkeleton count={5} />
            </View>
          ) : (
            <View style={s.empty}>
              <View style={[s.emptyIconWrap, { backgroundColor: theme.tertiary }]}>
                <Ionicons name="map-outline" size={36} color={theme.icon} />
              </View>
              <Text style={[s.emptyTitle, { color: theme.text }]}>No saved addresses</Text>
              <Text style={[s.emptySub, { color: theme.icon }]}>Add your home, office, or any location</Text>
              <TouchableOpacity style={[s.emptyBtn, { backgroundColor: theme.primary }]} onPress={openAdd}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={s.emptyBtnText}>Add Address</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      {/* ── Modal ── */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={s.overlay}>
          <View style={[s.sheet, { backgroundColor: theme.background, height: MODAL_HEIGHT }]}>
            {/* Handle */}
            <View style={[s.handle, { backgroundColor: theme.ash }]} />

            {/* Modal header */}
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: theme.text }]}>
                {editingId ? "Edit Address" : "New Address"}
              </Text>
              <TouchableOpacity onPress={closeModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={theme.icon} />
              </TouchableOpacity>
            </View>

            {/* Carousel — no dots */}
            <ScrollView
              ref={slideRef}
              horizontal
              pagingEnabled
              scrollEnabled={false}
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
            >
              {/* ════ Slide 1: Location ════ */}
              <View style={{ width: SCREEN_WIDTH, height: SLIDE_HEIGHT, flexDirection: "column" }}>
                {/* Section title */}
                <View style={s.slideHead}>
                  <Text style={[s.slideTitle, { color: theme.text }]}>Location</Text>
                </View>

                {/* Map — flex: 1, fills all space between title and fields */}
                <View style={[s.mapContainer, { flex: 1, marginHorizontal: 20, marginBottom: 12 }]}>
                  <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFillObject}
                    provider="google"
                    initialRegion={mapRegion}
                    onMapReady={() => setMapReady(true)}
                    onPress={handleMapPress}
                    showsPointsOfInterest={false}
                    showsBuildings={false}
                    toolbarEnabled={false}
                  >
                    {pinLat !== null && pinLng !== null && (
                      <Marker
                        coordinate={{ latitude: pinLat, longitude: pinLng }}
                        anchor={{ x: 0.5, y: 1 }}
                        draggable
                        onDragEnd={handleDragEnd}
                      >
                        <View style={s.pin}>
                          <View style={[s.pinBubble, { backgroundColor: theme.primary }]}>
                            <Ionicons name={icon as any} size={16} color="#fff" />
                          </View>
                          <View style={[s.pinTail, { borderTopColor: theme.primary }]} />
                        </View>
                      </Marker>
                    )}
                  </MapView>

                  {/* Loading overlay until map tiles load */}
                  {!mapReady && (
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.surface, justifyContent: "center", alignItems: "center", borderRadius: 16 }]}>
                      <ActivityIndicator size="large" color={theme.primary} />
                    </View>
                  )}

                  {/* Tooltip — shown only before any pin is dropped */}
                    <View style={[s.mapTooltip, { backgroundColor: theme.background + "EE" }]}>
                      <Ionicons name="finger-print-outline" size={13} color={theme.icon} />
                      <Text style={[s.coordText, { color: theme.icon }]}>Tap map or drag the pin</Text>
                    </View>

                  {/* Coords at bottom — shown once pin exists */}
                  {pinLat !== null && pinLng !== null && (
                    <View style={[s.mapOverlay, { backgroundColor: theme.background + "EE" }]}>
                      {geocoding
                        ? <ActivityIndicator size="small" color={theme.primary} />
                        : <Text style={[s.coordText, { color: theme.text }]}>
                            {pinLat.toFixed(5)}, {pinLng.toFixed(5)}
                          </Text>
                      }
                    </View>
                  )}
                </View>

                {/* Address fields — stacked column, QuantitySelect style */}
                <View style={s.fieldsCol}>
                  {([
                    { key: "street", label: "Street",    value: street,       set: setStreet,       placeholder: "Street address" },
                    { key: "city",   label: "City",      value: city,         set: setCity,         placeholder: "City"           },
                    { key: "state",  label: "State",     value: addressState, set: setAddressState, placeholder: "State"          },
                  ] as const).map((f) => (
                    <View key={f.key}>
                      <Text style={[s.fieldLabel, { color: theme.icon }]}>{f.label}</Text>
                      <View style={[s.inputWrapper, { borderColor: theme.ash, backgroundColor: theme.surface }]}>
                        <TextInput
                          value={f.value}
                          onChangeText={f.set}
                          placeholder={f.placeholder}
                          placeholderTextColor={theme.icon}
                          style={[s.inputText, { color: theme.text }]}
                          returnKeyType="next"
                          onSubmitEditing={() => Keyboard.dismiss()}
                        />
                      </View>
                    </View>
                  ))}
                </View>

                {/* Sticky Next footer */}
                <View style={[s.footer, { borderTopColor: theme.ash, backgroundColor: theme.background }]}>
                  <TouchableOpacity
                    style={[s.primaryBtn, { backgroundColor: theme.primary }]}
                    onPress={() => { Keyboard.dismiss(); goToSlide(1); }}
                    activeOpacity={0.85}
                  >
                    <Text style={s.primaryBtnText}>Next</Text>
                    <Ionicons name="chevron-forward" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* ════ Slide 2: Details ════ */}
              <View style={{ width: SCREEN_WIDTH, height: SLIDE_HEIGHT, flexDirection: "column" }}>
                {/* Section title */}
                <View style={s.slideHead}>
                  <Text style={[s.slideTitle, { color: theme.text }]}>Details</Text>
                </View>

                {/* Label input */}
                <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                  <Text style={[s.fieldLabel, { color: theme.icon }]}>Label *</Text>
                  <View style={[s.inputWrapper, { borderColor: theme.ash, backgroundColor: theme.surface }]}>
                    <TextInput
                      value={label}
                      onChangeText={setLabel}
                      placeholder="e.g. Home, Mum's place, The Office…"
                      placeholderTextColor={theme.icon}
                      style={[s.inputText, { color: theme.text }]}
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                    />
                  </View>
                </View>

                {/* Icon grid — 5 rows, scrolls horizontally */}
                <Text style={[s.fieldLabel, { color: theme.icon, paddingHorizontal: 20, marginBottom: 10 }]}>
                  Icon
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }}
                  style={{ flex: 1 }}
                >
                  <View style={{ flexDirection: "column", flexWrap: "wrap", height: ICON_GRID_HEIGHT, gap: CELL_GAP }}>
                    {ADDRESS_ICONS.map((iconName) => {
                      const selected = icon === iconName;
                      return (
                        <TouchableOpacity
                          key={iconName}
                          style={[
                            s.iconCell,
                            {
                              backgroundColor: selected ? theme.tertiary : theme.surface,
                              borderColor: selected ? theme.primary : theme.ash,
                            },
                          ]}
                          onPress={() => setIcon(iconName)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name={iconName as any} size={22} color={selected ? theme.primary : theme.icon} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                {/* Default address toggle */}
                <View style={[s.defaultRow, { paddingHorizontal: 20, borderTopColor: theme.ash }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.defaultRowLabel, { color: theme.text }]}>Set as default</Text>
                    <Text style={[s.defaultRowSub, { color: theme.icon }]}>
                      Used automatically on new orders
                    </Text>
                  </View>
                  <Switch
                    value={isDefaultToggle}
                    onValueChange={setIsDefaultToggle}
                    trackColor={{ false: theme.ash, true: theme.primary + "66" }}
                    thumbColor={isDefaultToggle ? theme.primary : theme.icon}
                  />
                </View>

                {/* Sticky Back + Save footer */}
                <View style={[s.footer, { borderTopColor: theme.ash, backgroundColor: theme.background }]}>
                  <TouchableOpacity
                    style={[s.secondaryBtn, { borderColor: theme.ash }]}
                    onPress={() => goToSlide(0)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-back" size={18} color={theme.text} />
                    <Text style={[s.secondaryBtnText, { color: theme.text }]}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.primaryBtn, { backgroundColor: theme.primary, flex: 2 }]}
                    onPress={saveAddress}
                    disabled={saving}
                    activeOpacity={0.85}
                  >
                    {saving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.primaryBtnText}>{editingId ? "Update" : "Save"}</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingVertical: 12,
    },
    headerTitle: { fontSize: 17, fontWeight: "500" },
    addIconBtn: {
      width: 40, height: 40, borderRadius: 12, borderWidth: 1,
      justifyContent: "center", alignItems: "center",
    },
    list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 },

    /* Address card */
    card: {
      flexDirection: "row", alignItems: "center",
      borderWidth: 1, borderRadius: 16, marginBottom: 12, padding: 14, gap: 12,
    },
    cardIconWrap: {
      width: 44, height: 44, borderRadius: 12,
      justifyContent: "center", alignItems: "center", flexShrink: 0,
    },
    cardContent: { flex: 1 },
    cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
    cardLabel: { fontSize: 14, fontWeight: "500" },
    defaultBadge: {
      flexDirection: "row", alignItems: "center", gap: 3,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1,
    },
    defaultBadgeText: { fontSize: 10, fontWeight: "500" },
    cardSub: { fontSize: 12, fontWeight: "300", lineHeight: 17 },
    cardCoords: { fontSize: 10, fontWeight: "300", marginTop: 2, fontVariant: ["tabular-nums" as any] },
    cardActions: { flexDirection: "row", gap: 2, flexShrink: 0 },
    actionBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },

    /* Empty */
    empty: { alignItems: "center", marginTop: 80, gap: 12 },
    emptyIconWrap: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center" },
    emptyTitle: { fontSize: 17, fontWeight: "500" },
    emptySub: { fontSize: 13, fontWeight: "300", textAlign: "center" },
    emptyBtn: {
      flexDirection: "row", gap: 6, alignItems: "center",
      paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginTop: 8,
    },
    emptyBtnText: { color: "#fff", fontSize: 14, fontWeight: "500" },

    /* Modal shell */
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: {
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingTop: 12, overflow: "hidden",
    },
    handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
    modalHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, marginBottom: 14,
    },
    modalTitle: { fontSize: 17, fontWeight: "500" },

    /* Slide common */
    slideHead: { paddingHorizontal: 20, marginBottom: 12 },
    slideTitle: { fontSize: 16, fontWeight: "500" },

    /* Map */
    mapContainer: { borderRadius: 16, overflow: "hidden" },
    pin: { alignItems: "center" },
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
    mapTooltip: {
      position: "absolute", top: 10, alignSelf: "center",
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
    },
    mapOverlay: {
      position: "absolute", bottom: 10, alignSelf: "center",
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
    },
    coordText: { fontSize: 11, fontWeight: "400" },

    /* Stacked column fields (slide 1) */
    fieldsCol: {
      flexDirection: "column", gap: 12,
      paddingHorizontal: 20, marginBottom: 8,
    },

    /* Shared input style — matches QuantitySelect exactly */
    fieldLabel: {
      fontSize: 13, fontWeight: "400", color: "#888", marginBottom: 8,
    },
    inputWrapper: {
      flexDirection: "row", alignItems: "center",
      borderWidth: 1.5, borderRadius: 14,
      paddingHorizontal: 14, height: 54,
    },
    inputText: {
      flex: 1, fontSize: 16, fontWeight: "300",
    },

    /* Default toggle row */
    defaultRow: {
      flexDirection: "row", alignItems: "center",
      paddingVertical: 14, gap: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      marginTop: 4,
    },
    defaultRowLabel: { fontSize: 14, fontWeight: "400" },
    defaultRowSub: { fontSize: 12, fontWeight: "300", marginTop: 2 },

    /* Icon grid (horizontal scroll, 5 rows) */
    iconCell: {
      width: ICON_CELL_SIZE,
      height: ICON_CELL_SIZE,
      borderRadius: 10, borderWidth: 1,
      justifyContent: "center", alignItems: "center",
    },

    /* Sticky footer */
    footer: {
      flexDirection: "row", gap: 12,
      paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    primaryBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 6, paddingVertical: 15, borderRadius: 14,
    },
    primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "500" },
    secondaryBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 4, paddingVertical: 15, borderRadius: 14, borderWidth: 1,
    },
    secondaryBtnText: { fontSize: 14, fontWeight: "400" },
  });
