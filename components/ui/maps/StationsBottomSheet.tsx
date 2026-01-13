import React, { forwardRef, useRef, useImperativeHandle, useMemo } from "react";
import { Dimensions } from "react-native";
import { Modalize } from "react-native-modalize";
import StationListItem from "./StationListItem";
import StationsFilterBar from "./StationsFilter";
import { useTheme } from "@/constants/theme";
import ScreenBackground from "../global/ScreenBackground";

export interface StationsBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface StationsBottomSheetProps {
  stations: any[];
  selectedStation: any;
  filters: any;
  sort: string;
  onChangeFilter: (key: string, value: any) => void;
  onSortChange: (value: string) => void;
  onSelectStation: (station: any) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const StationsBottomSheet = forwardRef<
  StationsBottomSheetRef,
  StationsBottomSheetProps
>(
  (
    {
      stations,
      selectedStation,
      filters,
      sort,
      onChangeFilter,
      onSortChange,
      onSelectStation,
    },
    ref
  ) => {
    const theme = useTheme();
    const modalRef = useRef<Modalize>(null);

    /** Find index of selected station */
    const selectedIndex = useMemo(() => {
      if (!selectedStation) return 0;
      const idx = stations.findIndex((s) => s._id === selectedStation._id);
      return idx === -1 ? 0 : idx;
    }, [stations, selectedStation]);

    /** Expose open / close */
    useImperativeHandle(ref, () => ({
      open: () => modalRef.current?.open(),
      close: () => modalRef.current?.close(),
    }));

    /** Scroll AFTER modal is open + small delay */
    const scrollToSelected = () => {
      if (!selectedStation) return;

      // Modalize does forward FlatList methods internally
      (modalRef.current as any)?.scrollToIndex?.({
        index: selectedIndex,
        animated: true,
        viewPosition: 0.2,
      });
    };

    return (
      <Modalize
        ref={modalRef}
        modalHeight={SCREEN_HEIGHT - 180} // near full screen
        adjustToContentHeight={false}
        handlePosition="inside"
        handleStyle={{ backgroundColor: theme.ash }}
        modalStyle={{
          backgroundColor: theme.background,
          paddingTop: 40,
          paddingHorizontal: 20,
        }}
        withHandle
        useNativeDriver
        /** 🔑 Open first, then pause, then scroll */
        onOpened={() => {
          setTimeout(() => {
            scrollToSelected();
          }, 300);
        }}
        flatListProps={{
          data: stations,
          keyExtractor: (item) => item._id,
          showsVerticalScrollIndicator: false,

          getItemLayout: (_, index) => ({
            length: 90, // row height estimate
            offset: 90 * index,
            index,
          }),

          ListHeaderComponent: (
            <StationsFilterBar
              filters={filters}
              onChangeFilter={onChangeFilter}
              sort={sort}
              onSortChange={onSortChange}
            />
          ),

          renderItem: ({ item }) => (
            <ScreenBackground>
              <StationListItem
                station={item}
                selected={item._id === selectedStation?._id}
                price={item.price}
                distance={item.distance}
                onPress={() => {
                  onSelectStation(item);
                  modalRef.current?.close(); // close after selecting
                }}
              />
            </ScreenBackground>
          ),
        }}
      />
    );
  }
);

export default StationsBottomSheet;