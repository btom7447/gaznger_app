import React, {
  forwardRef,
  useRef,
  useImperativeHandle,
  useMemo,
  useEffect,
  useState,
} from "react";
import { Dimensions, FlatList, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Modalize } from "react-native-modalize";
import StationListItem from "./StationListItem";
import StationsFilterBar from "./StationsFilter";
import StationListSkeleton from "@/components/ui/skeletons/StationListSkeleton";
import { useTheme } from "@/constants/theme";
import { Station } from "@/types";

export interface StationsBottomSheetRef {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
}

interface StationsBottomSheetProps {
  stations: Station[];
  selectedStation: Station | null;
  loading?: boolean;
  filters: Record<string, string>;
  sort: string;
  radius?: number;
  onChangeFilter: (key: string, value: string) => void;
  onSortChange: (value: string) => void;
  onRadiusChange?: (km: number) => void;
  onSelectStation: (station: Station) => void;
  onClose?: () => void;
  onGazngerPick?: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const ITEM_HEIGHT = 120;

const StationsBottomSheet = forwardRef<
  StationsBottomSheetRef,
  StationsBottomSheetProps
>(
  (
    {
      stations,
      selectedStation,
      loading = false,
      filters,
      sort,
      radius,
      onChangeFilter,
      onSortChange,
      onRadiusChange,
      onSelectStation,
      onClose,
      onGazngerPick,
    },
    ref
  ) => {
    const theme = useTheme();
    const modalRef = useRef<Modalize>(null);
    const flatListRef = useRef<FlatList>(null);
    const [open, setOpen] = useState(false);

    const selectedIndex = useMemo(() => {
      if (!selectedStation) return -1;
      return stations.findIndex((s) => s._id === selectedStation._id);
    }, [stations, selectedStation]);

    useImperativeHandle(ref, () => ({
      open: () => { modalRef.current?.open(); setOpen(true); },
      close: () => { modalRef.current?.close(); setOpen(false); },
      toggle: () => {
        if (open) { modalRef.current?.close(); setOpen(false); }
        else { modalRef.current?.open(); setOpen(true); }
      },
      isOpen: () => open,
    }));

    const scrollToSelected = (animated = true) => {
      if (selectedIndex < 0 || !flatListRef.current) return;
      try {
        flatListRef.current.scrollToIndex({
          index: selectedIndex,
          animated,
          viewPosition: 0.3,
        });
      } catch {
        // fallback: scroll to offset
        flatListRef.current.scrollToOffset({
          offset: selectedIndex * ITEM_HEIGHT,
          animated,
        });
      }
    };

    // Scroll whenever the selected station changes — delay covers sheet open animation
    useEffect(() => {
      if (selectedIndex < 0) return;
      const t = setTimeout(() => scrollToSelected(true), 400);
      return () => clearTimeout(t);
    }, [selectedIndex]);

    const handleClose = () => {
      modalRef.current?.close();
      setOpen(false);
    };

    return (
      <Modalize
        ref={modalRef}
        modalHeight={SCREEN_HEIGHT - 180}
        adjustToContentHeight={false}
        panGestureEnabled={false}
        withHandle={false}
        modalStyle={{
          backgroundColor: theme.background,
          paddingHorizontal: 16,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
        useNativeDriver
        onOpened={() => setOpen(true)}
        onClosed={() => { setOpen(false); onClose?.(); }}
        HeaderComponent={
          <View style={[styles.sheetHeader, { borderBottomColor: theme.ash }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Nearby Stations</Text>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.closeBtn, { backgroundColor: theme.surface }]}
            >
              <Ionicons name="close" size={16} color={theme.text} />
            </TouchableOpacity>
          </View>
        }
        FooterComponent={
          <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.ash }]}>
            <TouchableOpacity
              style={[styles.gazngerBtn, { backgroundColor: theme.primary }]}
              onPress={onGazngerPick}
              activeOpacity={0.85}
            >
              <Text style={styles.gazngerBtnText}>Let Gaznger Choose</Text>
            </TouchableOpacity>
          </View>
        }
        flatListProps={{
          // ref: flatListRef,
          data: stations,
          keyExtractor: (item: any) => item._id,
          showsVerticalScrollIndicator: false,
          getItemLayout: (_: any, index: number) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          }),
          ListHeaderComponent: (
            <StationsFilterBar
              filters={filters}
              onChangeFilter={onChangeFilter}
              sort={sort}
              onSortChange={onSortChange}
              radius={radius}
              onRadiusChange={onRadiusChange}
            />
          ),
          ListEmptyComponent: loading ? (
            <View style={{ paddingTop: 8 }}>
              <StationListSkeleton count={4} />
            </View>
          ) : null,
          renderItem: ({ item }: { item: any }) => (
            <StationListItem
              station={item}
              selected={item._id === selectedStation?._id}
              price={item.price}
              distance={item.distance}
              onPress={() => onSelectStation(item)}
            />
          ),
        }}
      />
    );
  }
);

export default StationsBottomSheet;

const styles = StyleSheet.create({
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  gazngerBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  gazngerBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
});
