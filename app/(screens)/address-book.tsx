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
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
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
import {
  FloatingCTA,
  KebabMenu,
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";

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

  /* ── Address list card (v3) ──
   * Two ways to act on a row, per UX direction (we ship both):
   *   1. Tap the kebab → action sheet (Edit / Set as default / Delete)
   *   2. Swipe left → reveals Edit + Delete buttons inline
   * Whole-row tap sets the address as default — fastest path for the
   * most common action.
   */
  // The row is its own component so the per-row hooks (`useRef` for the
  // Swipeable handle) don't violate the rules-of-hooks. FlatList's
  // `renderItem` is a regular function — calling hooks inside it crashes
  // React with "Invalid hook call" because the row count varies between
  // renders (the hook order isn't stable).
  const renderItem = ({ item }: { item: Address }) => (
    <AddressRow
      item={item}
      theme={theme}
      styles={s}
      onSetDefault={setDefault}
      onEdit={openEdit}
      onDelete={deleteAddress}
    />
  );

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      noScroll
      header={
        <ScreenHeader
          title="Saved addresses"
          subtitle={
            addresses.length > 0
              ? `${addresses.length} saved`
              : undefined
          }
        />
      }
      footer={
        addresses.length > 0 ? (
          <FloatingCTA
            label="Add new address"
            iconLeft="add"
            onPress={openAdd}
            floating={false}
          />
        ) : undefined
      }
    >
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
              <View style={[s.emptyIconWrap, { backgroundColor: theme.bgMuted }]}>
                <Ionicons name="location-outline" size={32} color={theme.fgMuted} />
              </View>
              <Text style={[s.emptyTitle, { color: theme.fg }]}>No addresses yet</Text>
              <Text style={[s.emptySub, { color: theme.fgMuted }]}>
                Add a few favourites — Home, Office, anywhere we should
                bring fuel.
              </Text>
              <TouchableOpacity
                style={[s.emptyBtn, { backgroundColor: theme.primary }]}
                onPress={openAdd}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={s.emptyBtnText}>Add address</Text>
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
    </ScreenContainer>
  );
}

/* ─────────────────────── AddressRow ─────────────────────────── */

/**
 * One row in the address list. Lifted into its own component so the
 * `useRef<Swipeable>` per-row hook lives in a real component body —
 * calling it inside `FlatList.renderItem` (a regular function) was
 * triggering React's rules-of-hooks check and crashing the screen with
 * "Invalid hook call".
 *
 * Two affordances stay (per UX direction "let's go with both"):
 *   1. Tap the kebab → action sheet (Edit / Set default / Delete)
 *   2. Swipe left → reveals Edit + Delete buttons inline
 * Whole-row tap sets the address as default — the most common action.
 */
function AddressRow({
  item,
  theme,
  styles: s,
  onSetDefault,
  onEdit,
  onDelete,
}: {
  item: Address;
  theme: ReturnType<typeof useTheme>;
  styles: ReturnType<typeof styles>;
  onSetDefault: (id: string) => void;
  onEdit: (a: Address) => void;
  onDelete: (id: string) => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

  const renderRightActions = () => (
    <View style={s.swipeActions}>
      <Pressable
        onPress={() => {
          swipeRef.current?.close();
          onEdit(item);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${item.label}`}
        style={({ pressed }) => [
          s.swipeBtn,
          { backgroundColor: theme.bgMuted },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons name="create-outline" size={20} color={theme.fg} />
        <Text style={[s.swipeBtnText, { color: theme.fg }]}>Edit</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          swipeRef.current?.close();
          onDelete(item._id);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${item.label}`}
        style={({ pressed }) => [
          s.swipeBtn,
          { backgroundColor: theme.errorTint },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons name="trash-outline" size={20} color={theme.error} />
        <Text style={[s.swipeBtnText, { color: theme.error }]}>Delete</Text>
      </Pressable>
    </View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <Pressable
        onPress={() => !item.isDefault && onSetDefault(item._id)}
        accessibilityRole="button"
        accessibilityLabel={
          item.isDefault
            ? `${item.label}, default address`
            : `${item.label}. Tap to set as default.`
        }
        style={({ pressed }) => [
          s.cardV3,
          {
            backgroundColor: theme.surface,
            borderColor: item.isDefault ? theme.primary : theme.divider,
          },
          pressed && { opacity: 0.94 },
        ]}
      >
        <View style={[s.cardIconV3, { backgroundColor: theme.primaryTint }]}>
          <Ionicons
            name={(item.icon ?? "location-outline") as any}
            size={18}
            color={theme.mode === "dark" ? "#fff" : theme.palette.green700}
          />
        </View>

        <View style={s.cardBody}>
          <View style={s.cardTitleRowV3}>
            <Text
              style={[s.cardLabelV3, { color: theme.fg }]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            {item.isDefault ? (
              <View
                style={[s.defaultBadgeV3, { backgroundColor: theme.primaryTint }]}
              >
                <Text
                  style={[
                    s.defaultBadgeTextV3,
                    {
                      color:
                        theme.mode === "dark"
                          ? "#fff"
                          : theme.palette.green700,
                    },
                  ]}
                >
                  DEFAULT
                </Text>
              </View>
            ) : null}
          </View>
          {item.street || item.city ? (
            <Text
              style={[s.cardSubV3, { color: theme.fg }]}
              numberOfLines={2}
            >
              {[item.street, item.city, item.state]
                .filter(Boolean)
                .join(", ")}
            </Text>
          ) : null}
        </View>

        <KebabMenu
          title="Address actions"
          accessibilityLabel={`${item.label} actions`}
          actions={[
            {
              label: "Edit",
              icon: "create-outline",
              onPress: () => onEdit(item),
            },
            ...(!item.isDefault
              ? [
                  {
                    label: "Set as default",
                    icon: "star-outline" as const,
                    onPress: () => onSetDefault(item._id),
                  },
                ]
              : []),
            {
              label: "Delete",
              icon: "trash-outline",
              danger: true,
              onPress: () => onDelete(item._id),
            },
          ]}
        />
      </Pressable>
    </Swipeable>
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

    /**
     * Address card — v3 design (replaces .card on the list view).
     * Aligns content to flex-start so the kebab sits at the top
     * with the label rather than centred between label + sub line —
     * matches the design exactly.
     */
    cardV3: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.space.s3,
      padding: theme.space.s3 + 2,
      marginBottom: theme.space.s3,
      borderRadius: theme.radius.md + 2, // 14 per design
      borderWidth: 1,
    },
    cardIconV3: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.md - 2, // 10
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    cardBody: { flex: 1, minWidth: 0 },
    cardTitleRowV3: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s2,
      marginBottom: 4,
    },
    cardLabelV3: {
      ...theme.type.body,
      fontWeight: "800",
      flexShrink: 1,
    },
    defaultBadgeV3: {
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.space.s2,
      paddingVertical: 2,
    },
    defaultBadgeTextV3: {
      ...theme.type.micro,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    cardSubV3: {
      ...theme.type.bodySm,
      lineHeight: 18,
    },

    /* Swipe-revealed actions */
    swipeActions: {
      flexDirection: "row",
      alignItems: "stretch",
      // Match the card's bottom margin so the swipe surface aligns.
      marginBottom: theme.space.s3,
      borderRadius: theme.radius.md + 2,
      overflow: "hidden",
    },
    swipeBtn: {
      width: 80,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    swipeBtnText: {
      ...theme.type.micro,
      fontWeight: "800",
    },

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
