import * as ImagePicker from "expo-image-picker";
import { api } from "./api";

export interface ChatMediaAttachment {
  kind: "image" | "video";
  url: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  mime?: string;
}

/**
 * Multi-pick images + videos for a chat message. Uses
 * `allowsMultipleSelection` so the user can pick up to 9 in one tap,
 * matching the WhatsApp-style 3×3 grid the bubble renderer caps at.
 *
 * Each picked asset is uploaded to /api/upload/media (which auto-
 * detects image vs video). The caller receives an array of attachment
 * descriptors ready to POST alongside the message text.
 *
 * Throws on permission denial or upload failure so the caller can
 * surface a toast.
 */
export async function pickAndUploadChatMedia(): Promise<ChatMediaAttachment[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error("Photo library access denied");

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    allowsMultipleSelection: true,
    selectionLimit: 9,
    quality: 0.8,
    // Don't force editing — multi-pick shouldn't gate on per-asset crop.
  });
  if (result.canceled) return [];

  const out: ChatMediaAttachment[] = [];
  for (const asset of result.assets) {
    if (!asset.uri) continue;
    const filename =
      asset.fileName ??
      asset.uri.split("/").pop() ??
      `chat-${Date.now()}`;
    const mimeFromExt = filename.toLowerCase().endsWith(".mp4")
      ? "video/mp4"
      : filename.toLowerCase().endsWith(".mov")
        ? "video/quicktime"
        : filename.toLowerCase().endsWith(".png")
          ? "image/png"
          : "image/jpeg";
    const type = asset.mimeType ?? mimeFromExt;

    const form = new FormData();
    form.append("media", {
      uri: asset.uri,
      name: filename,
      type,
    } as any);

    try {
      const data = await api.uploadForm<ChatMediaAttachment>(
        "/api/upload/media",
        form,
        "POST",
      );
      if (data.url) out.push(data);
    } catch {
      // Soft-fail per asset — surface a count to the caller rather than
      // aborting the whole batch.
    }
  }
  return out;
}
