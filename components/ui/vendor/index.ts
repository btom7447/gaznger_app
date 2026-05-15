// Vendor UI primitives — shared atoms used across every (vendor)/* screen.
// Keep this list short and stable; one component per file.

export { default as VendorTabBar } from "./VendorTabBar";
export { default as VendorScreenShell } from "./VendorScreenShell";
export { default as StationSwitcher } from "./StationSwitcher";

export { default as VendorPill } from "./VendorPill";
export type { PillTone, VendorPillProps } from "./VendorPill";

export { default as VendorCard } from "./VendorCard";
export type { VendorCardProps } from "./VendorCard";

export { default as StatTile } from "./StatTile";
export type { StatTileProps } from "./StatTile";

export { default as AlertChip } from "./AlertChip";
export type { AlertChipProps, AlertTone } from "./AlertChip";

export { default as OrderRow } from "./OrderRow";
export type { OrderRowProps, OrderStatus } from "./OrderRow";

export { default as RiderCard } from "./RiderCard";
export type { RiderCardProps, RiderStatus } from "./RiderCard";

export { default as Skel, SkelStack } from "./Skel";
export type { SkelProps } from "./Skel";

export { default as VendorEmptyState } from "./VendorEmptyState";
export type { VendorEmptyStateProps } from "./VendorEmptyState";

export { default as TodayHeroCard } from "./TodayHeroCard";
export type { TodayHeroCardProps } from "./TodayHeroCard";

export { default as TodayMiniGrid } from "./TodayMiniGrid";
export type { TodayNextOrder, TodayTeamStatus } from "./TodayMiniGrid";

export { default as FilterPills } from "./FilterPills";
export type { FilterPillOption, FilterPillsProps } from "./FilterPills";

export { default as AssignRiderSheet } from "./AssignRiderSheet";
export type { AssignRiderSheetRef, AssignRiderMode } from "./AssignRiderSheet";

export { default as BulkInFlightCard } from "./BulkInFlightCard";
export type { BulkInFlightCardProps } from "./BulkInFlightCard";

export { default as BulkTrackerTimeline } from "./BulkTrackerTimeline";
export type {
  BulkTrackerTimelineProps,
  TimelineEntry,
} from "./BulkTrackerTimeline";
