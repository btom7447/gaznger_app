import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useSessionStore } from "@/store/useSessionStore";

const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL ?? "http://localhost:5000";

/**
 * Download the server-generated receipt PDF for an order, then trigger
 * the OS share sheet so the user can preview/save/email it.
 *
 * The endpoint requires auth; we hit it with `downloadAsync` + the
 * Authorization header rather than letting `Linking.openURL` resolve
 * a public URL (would force us to issue presigned URLs and adds an
 * S3 dependency we don't otherwise need).
 *
 * Throws on network/server failure so callers can show an error toast.
 */
export async function shareReceiptPdf(orderId: string): Promise<void> {
  const { accessToken } = useSessionStore.getState();
  if (!accessToken) throw new Error("Not signed in");

  const filename = `gaznger-receipt-${orderId.slice(-6).toUpperCase()}.pdf`;
  const localPath = `${FileSystem.cacheDirectory}${filename}`;

  const { status } = await FileSystem.downloadAsync(
    `${BASE_URL}/api/orders/${orderId}/receipt.pdf`,
    localPath,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (status < 200 || status >= 300) {
    throw new Error(`Server returned ${status}`);
  }

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    // No share sheet (rare on RN — Android < some old version, etc.)
    // Throw a friendly error so the caller can fall back to the legacy
    // text Share.share path.
    throw new Error("Sharing not available on this device");
  }

  await Sharing.shareAsync(localPath, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: "Share receipt",
  });
}
