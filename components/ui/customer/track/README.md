# Track screen UI — recipes & gotchas

## Bottom sheet (gorhom v5)

Three footguns we hit and fixed; document so future sheets don't
repeat the debugging.

### 1. `enableDynamicSizing` defaults to `true` and ignores `snapPoints`

In gorhom v4, snap points worked out of the box. In v5, the default
behavior is to size dynamically from content height — your snapPoints
array is silently ignored.

**Fix:** always set `enableDynamicSizing={false}` when using snap points.

```tsx
<BottomSheet
  ref={sheetRef}
  snapPoints={snapPoints}
  enableDynamicSizing={false}  // <-- required in v5
  index={1}
>
  ...
</BottomSheet>
```

### 2. Inline snapPoints array thrashes state

If you pass `snapPoints={["18%", "45%", "85%"]}` inline, every render
creates a new array reference, which the sheet treats as a new
snapPoints definition and re-measures from scratch. Symptom: sheet
"flashes" or sticks at the wrong index after every parent re-render.

**Fix:** memoize.

```tsx
const snapPoints = useMemo(() => ["18%", "45%", "85%"], []);
```

### 3. Plain `View` as immediate child breaks gestures

The sheet's pan recognizer expects `BottomSheetView` (or
`BottomSheetScrollView`) as its immediate child. Plain `View` works on
iOS but on Android v5 the internal scroll/drag detection breaks, often
leaving the sheet rendered off-screen until the user manually drags it
up.

**Fix:** always wrap the content.

```tsx
<BottomSheet>
  <BottomSheetView style={styles.content}>
    {/* ...your content... */}
  </BottomSheetView>
</BottomSheet>
```

### 4. Pressables inside the sheet get eaten by the pan handler

Symptom: tapping a button inside the sheet snaps the sheet up instead
of firing onPress. Especially bad on Android.

**Fix:** import `TouchableOpacity` from `react-native-gesture-handler`,
not `react-native`. The gesture-handler version cooperates with the
sheet's pan recognizer; the RN version fights it.

```tsx
import { TouchableOpacity } from "react-native-gesture-handler";
```

## Phase 7 — `useOrderState`

Track-flow screens (Track index, Arrival, Handoff, Delivered, Complete)
should consume `useOrderState(orderId)` instead of maintaining their
own copy of `serverStatus` / `eta` / `rider` / `riderCoord`.

The hook:
- Reads from a module-level cache so quick remounts don't flash.
- Fires one GET if cache is missing or >30s stale.
- Subscribes to `order:update` + `rider:location` for real-time updates.
- Re-fetches on socket reconnect via `subscribeReconnect`.

```tsx
const { snapshot, hydrated, refresh } = useOrderState(orderId);

if (!hydrated) {
  return <SkeletonView />;
}

return (
  <View>
    <Text>{snapshot.status}</Text>
    <Text>ETA: {snapshot.eta} min</Text>
    {snapshot.rider && <RiderCard rider={snapshot.rider} />}
  </View>
);
```

Migration note: existing screens still maintain their own state for
historical reasons; convert one screen at a time as you touch them.
The hook is fully backward-compatible with screens that aren't yet
migrated (it just maintains its own copy alongside).
