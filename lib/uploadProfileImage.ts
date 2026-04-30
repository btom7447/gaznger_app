import * as ImagePicker from "expo-image-picker";
import { api } from "./api";

/**
 * Pick an image from the library and upload it to /api/upload/image.
 *
 * Returns the secure_url from Cloudinary on success, or null when the
 * user cancels. Throws on permission denial or upload failure so the
 * caller can surface a toast.
 *
 * Server contract:
 *   - multer field name: "image"
 *   - allowed mime types: image/jpeg, image/png, image/webp (HEIC
 *     gets converted by expo-image-picker before upload because we
 *     pass `allowsEditing: true` which forces a re-encode)
 *   - max size: 5 MB
 */
export async function pickAndUploadProfileImage(): Promise<string | null> {
  // Request permission first — expo-image-picker no longer auto-prompts
  // on Android 13+ without a granted permission.
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error("Photo library access denied");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset?.uri) throw new Error("No image returned from picker");

  // Pull a friendly filename + mime off the asset. expo-image-picker's
  // `mimeType` lands the correct value when allowsEditing kicks the
  // re-encode; fall back to image/jpeg as a safe default.
  const filename =
    asset.fileName ??
    asset.uri.split("/").pop() ??
    `profile-${Date.now()}.jpg`;
  const type = asset.mimeType ?? "image/jpeg";

  const formData = new FormData();
  formData.append("image", {
    uri: asset.uri,
    name: filename,
    type,
  } as any);

  const data = await api.uploadForm<{ url?: string }>(
    "/api/upload/image",
    formData,
    "POST"
  );
  if (!data.url) throw new Error("Upload succeeded but no URL returned");
  return data.url;
}
