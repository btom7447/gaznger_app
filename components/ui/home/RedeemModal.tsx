import React, {
  forwardRef,
  useRef,
  useImperativeHandle,
  useState,
  useEffect,
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Modalize } from "react-native-modalize";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { api } from "@/lib/api";

export interface RedeemModalHandles {
  open: () => void;
  close: () => void;
}

interface RedeemModalProps {
  /** Pre-select a specific order (e.g. from the payment screen). Hides the order list. */
  orderId?: string;
  /** Called with the updated order total after a successful redemption. */
  onRedeemed?: (updatedOrderTotal: number) => void;
}

interface PendingOrder {
  _id: string;
  totalPrice: number;
  fuel?: { name: string };
  createdAt: string;
}

const RedeemModal = forwardRef<RedeemModalHandles, RedeemModalProps>(
  ({ orderId: preselectedOrderId, onRedeemed }, ref) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const modalRef = useRef<Modalize>(null);
  const user = useSessionStore((s) => s.user);
  const updateUser = useSessionStore((s) => s.updateUser);

  const userPoints = user?.points ?? 0;

  const [pointsInput, setPointsInput] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(preselectedOrderId ?? null);
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useImperativeHandle(ref, () => ({
    open: () => {
      setPointsInput("");
      setSelectedOrderId(preselectedOrderId ?? null);
      modalRef.current?.open();
      if (!preselectedOrderId) fetchPendingOrders();
    },
    close: () => modalRef.current?.close(),
  }));

  const fetchPendingOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await api.get<{ data: PendingOrder[] }>(
        "/api/orders?status=pending&page=1&limit=10"
      );
      setOrders(res.data ?? []);
    } catch {
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const pointsToRedeem = Math.min(
    parseInt(pointsInput || "0", 10) || 0,
    userPoints
  );
  const selectedOrder = orders.find((o) => o._id === selectedOrderId);
  const newTotal = selectedOrder
    ? Math.max(0, selectedOrder.totalPrice - pointsToRedeem)
    : null;

  const canSubmit =
    pointsToRedeem > 0 && !!selectedOrderId && !submitting;

  const handleApply = async () => {
    if (!canSubmit || !selectedOrderId) return;
    setSubmitting(true);
    try {
      const res = await api.post<{ newPointsBalance: number; updatedOrderTotal: number }>(
        "/api/points/redeem",
        { orderId: selectedOrderId, pointsToRedeem }
      );
      updateUser({ points: res.newPointsBalance });
      onRedeemed?.(res.updatedOrderTotal);
      toast.success("Points applied!", {
        description: `${pointsToRedeem} pts redeemed. New balance: ${res.newPointsBalance} pts`,
      });
      modalRef.current?.close();
    } catch (err: any) {
      toast.error("Could not redeem points", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const s = styles(theme);

  return (
    <Modalize
      ref={modalRef}
      adjustToContentHeight
      panGestureEnabled={false}
      withHandle={false}
      modalStyle={{ backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
      HeaderComponent={
        <View style={s.header}>
          <Text style={[s.headerTitle, { color: theme.text }]}>Redeem Points</Text>
          <TouchableOpacity
            onPress={() => modalRef.current?.close()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[s.closeBtn, { backgroundColor: theme.surface }]}
          >
            <Ionicons name="close" size={16} color={theme.text} />
          </TouchableOpacity>
        </View>
      }
    >
      <View style={[s.content, { paddingBottom: Math.max(insets.bottom, 16) + 62 }]}>
        {/* Balance */}
        <View style={[s.balanceCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
          <Text style={[s.balanceLabel, { color: theme.icon }]}>Available Balance</Text>
          <Text style={[s.balanceValue, { color: theme.primary }]}>
            {userPoints.toLocaleString()} pts
          </Text>
          <Text style={[s.balanceNaira, { color: theme.icon }]}>
            = ₦{userPoints.toLocaleString()}
          </Text>
        </View>

        {/* Points input */}
        <Text style={[s.label, { color: theme.text }]}>Points to redeem</Text>
        <View style={[s.inputWrap, { borderColor: theme.ash, backgroundColor: theme.surface }]}>
          <TextInput
            style={[s.input, { color: theme.text }]}
            keyboardType="numeric"
            placeholder={`Max ${userPoints}`}
            placeholderTextColor={theme.icon}
            value={pointsInput}
            onChangeText={(v) => {
              const n = parseInt(v, 10);
              if (isNaN(n)) setPointsInput("");
              else setPointsInput(String(Math.min(n, userPoints)));
            }}
          />
          <TouchableOpacity onPress={() => setPointsInput(String(userPoints))}>
            <Text style={[s.maxBtn, { color: theme.primary }]}>MAX</Text>
          </TouchableOpacity>
        </View>

        {/* Order selection — hidden when a specific orderId is pre-selected */}
        {!preselectedOrderId && (
          <>
            <Text style={[s.label, { color: theme.text }]}>Apply to order</Text>
            {loadingOrders ? (
              <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 12 }} />
            ) : orders.length === 0 ? (
              <Text style={[s.emptyText, { color: theme.icon }]}>No pending orders to apply points to</Text>
            ) : (
              <FlatList
                data={orders}
                keyExtractor={(item) => item._id}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const isSelected = item._id === selectedOrderId;
                  return (
                    <TouchableOpacity
                      onPress={() => setSelectedOrderId(item._id)}
                      style={[
                        s.orderItem,
                        { borderColor: isSelected ? theme.primary : theme.ash, backgroundColor: theme.surface },
                      ]}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.orderName, { color: theme.text }]}>
                          {item.fuel?.name ?? "Fuel order"}
                        </Text>
                        <Text style={[s.orderSub, { color: theme.icon }]}>
                          ₦{item.totalPrice.toLocaleString()}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </>
        )}

        {/* New total preview */}
        {newTotal !== null && pointsToRedeem > 0 && (
          <View style={[s.previewCard, { backgroundColor: theme.tertiary, borderColor: theme.ash }]}>
            <Text style={[s.previewLabel, { color: theme.icon }]}>New order total</Text>
            <Text style={[s.previewValue, { color: theme.text }]}>₦{newTotal.toLocaleString()}</Text>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          onPress={handleApply}
          activeOpacity={0.85}
          style={[
            s.applyBtn,
            { backgroundColor: canSubmit ? theme.primary : theme.ash, opacity: canSubmit ? 1 : 0.6 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={s.applyBtnText}>Apply Points</Text>
          )}
        </TouchableOpacity>
      </View>
    </Modalize>
  );
});

export default RedeemModal;

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.ash,
    },
    headerTitle: { fontSize: 17, fontWeight: "600" },
    closeBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    content: { paddingHorizontal: 20, paddingTop: 16 },
    balanceCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 16,
      alignItems: "center",
      marginBottom: 20,
    },
    balanceLabel: { fontSize: 12, fontWeight: "300", marginBottom: 4 },
    balanceValue: { fontSize: 28, fontWeight: "600" },
    balanceNaira: { fontSize: 13, fontWeight: "300", marginTop: 2 },
    label: { fontSize: 14, fontWeight: "400", marginBottom: 8 },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 14,
      marginBottom: 20,
    },
    input: { flex: 1, fontSize: 16, paddingVertical: 14 },
    maxBtn: { fontSize: 12, fontWeight: "600", paddingLeft: 8 },
    emptyText: { fontSize: 13, marginBottom: 16 },
    orderItem: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1.5,
      padding: 14,
      marginBottom: 8,
    },
    orderName: { fontSize: 14, fontWeight: "400" },
    orderSub: { fontSize: 12, fontWeight: "300", marginTop: 2 },
    previewCard: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
      marginTop: 4,
      marginBottom: 16,
    },
    previewLabel: { fontSize: 13, fontWeight: "300" },
    previewValue: { fontSize: 16, fontWeight: "600" },
    applyBtn: {
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: "center",
      marginTop: 8,
    },
    applyBtnText: { color: "#fff", fontWeight: "500", fontSize: 16 },
  });
