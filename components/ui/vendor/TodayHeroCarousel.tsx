import React, { useMemo } from "react";
import {
  Dimensions,
  FlatList,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from "react-native";
import TodayHeroCard, { type TodayHeroCardProps } from "./TodayHeroCard";

/**
 * Horizontal peek-and-snap carousel of TodayHeroCard.
 *
 * Card 0 is always the aggregate (all-stations). Cards 1..N are
 * per-station summaries the server returns under `perStation`. Width
 * is sized so the next card peeks by ~16pt on the right edge.
 *
 * No page dots — the peeking next card is the affordance.
 */

export interface TodayHeroCarouselProps {
  aggregate: TodayHeroCardProps;
  perStation: Array<TodayHeroCardProps & { stationId: string }>;
}

const SCREEN_PADDING = 20;
const GAP = 12;
const PEEK = 16;

interface CarouselItem {
  key: string;
  props: TodayHeroCardProps;
}

export default function TodayHeroCarousel({
  aggregate,
  perStation,
}: TodayHeroCarouselProps) {
  const items: CarouselItem[] = useMemo(
    () => [
      { key: "aggregate", props: aggregate },
      ...perStation.map((s) => {
        const { stationId, ...rest } = s;
        return { key: stationId, props: rest };
      }),
    ],
    [aggregate, perStation],
  );

  const cardWidth = useMemo(() => {
    const screenW = Dimensions.get("window").width;
    return screenW - SCREEN_PADDING * 2 - PEEK;
  }, []);
  const snapInterval = cardWidth + GAP;

  const styles = useMemo(() => makeStyles(), []);

  const renderItem = ({ item }: ListRenderItemInfo<CarouselItem>) => (
    <View style={{ width: cardWidth }}>
      <TodayHeroCard {...item.props} />
    </View>
  );

  return (
    <FlatList
      data={items}
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={snapInterval}
      snapToAlignment="start"
      contentContainerStyle={styles.scroll}
      ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
      renderItem={renderItem}
      keyExtractor={(item) => item.key}
    />
  );
}

const makeStyles = () =>
  StyleSheet.create({
    scroll: {
      // No paddingLeft here — the parent screen already pads the
      // content with 20pt. The peek lives on the right via cardWidth.
      paddingRight: SCREEN_PADDING,
    },
  });
