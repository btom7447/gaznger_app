import { Stack } from "expo-router";
import React from "react";

export default function VendorFinanceLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="transactions" />
      <Stack.Screen name="transaction/[id]" />
      <Stack.Screen name="earnings" />
      <Stack.Screen name="payouts" />
      <Stack.Screen name="payout/[id]" />
      <Stack.Screen name="withdraw" />
      <Stack.Screen name="banks" />
      <Stack.Screen name="bank-add" />
      <Stack.Screen name="kyc" />
      <Stack.Screen name="payout-failed/[id]" />
      <Stack.Screen name="low-balance" />
    </Stack>
  );
}
