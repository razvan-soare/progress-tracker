import * as ImagePicker from "expo-image-picker";
import {
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  copyAsync,
  deleteAsync,
} from "expo-file-system/legacy";
import { Alert, Linking, Platform } from "react-native";
import { generateId } from "./id";

export type ImagePickerResult =
  | { success: true; uri: string }
  | { success: false; error: string; cancelled?: boolean };

const IMAGE_QUALITY = 0.8;
const IMAGES_DIRECTORY = `${documentDirectory}images/`;

async function ensureImagesDirectory(): Promise<void> {
  const dirInfo = await getInfoAsync(IMAGES_DIRECTORY);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(IMAGES_DIRECTORY, { intermediates: true });
  }
}

async function showPermissionDeniedAlert(permissionType: "camera" | "photos"): Promise<void> {
  const title = permissionType === "camera" ? "Camera Access Required" : "Photo Library Access Required";
  const message =
    permissionType === "camera"
      ? "Please enable camera access in Settings to take photos."
      : "Please enable photo library access in Settings to choose images.";

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    {
      text: "Open Settings",
      onPress: () => {
        if (Platform.OS === "ios") {
          Linking.openURL("app-settings:");
        } else {
          Linking.openSettings();
        }
      },
    },
  ]);
}

async function requestCameraPermission(): Promise<boolean> {
  const { status: existingStatus } = await ImagePicker.getCameraPermissionsAsync();

  if (existingStatus === "granted") {
    return true;
  }

  const { status } = await ImagePicker.requestCameraPermissionsAsync();

  if (status !== "granted") {
    await showPermissionDeniedAlert("camera");
    return false;
  }

  return true;
}

async function requestMediaLibraryPermission(): Promise<boolean> {
  const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();

  if (existingStatus === "granted") {
    return true;
  }

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (status !== "granted") {
    await showPermissionDeniedAlert("photos");
    return false;
  }

  return true;
}

async function saveImageToDocuments(sourceUri: string): Promise<string> {
  await ensureImagesDirectory();

  const fileExtension = sourceUri.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `${generateId()}.${fileExtension}`;
  const destinationUri = `${IMAGES_DIRECTORY}${fileName}`;

  await copyAsync({
    from: sourceUri,
    to: destinationUri,
  });

  return destinationUri;
}

export async function pickImageFromCamera(): Promise<ImagePickerResult> {
  try {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      return { success: false, error: "Camera permission denied" };
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: IMAGE_QUALITY,
      exif: false,
    });

    if (result.canceled) {
      return { success: false, error: "User cancelled", cancelled: true };
    }

    const asset = result.assets[0];
    if (!asset?.uri) {
      return { success: false, error: "No image captured" };
    }

    const savedUri = await saveImageToDocuments(asset.uri);
    return { success: true, uri: savedUri };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to capture image";
    return { success: false, error: message };
  }
}

export async function pickImageFromLibrary(): Promise<ImagePickerResult> {
  try {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      return { success: false, error: "Photo library permission denied" };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: IMAGE_QUALITY,
      exif: false,
    });

    if (result.canceled) {
      return { success: false, error: "User cancelled", cancelled: true };
    }

    const asset = result.assets[0];
    if (!asset?.uri) {
      return { success: false, error: "No image selected" };
    }

    const savedUri = await saveImageToDocuments(asset.uri);
    return { success: true, uri: savedUri };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to select image";
    return { success: false, error: message };
  }
}

export async function deleteImage(uri: string): Promise<boolean> {
  try {
    const fileInfo = await getInfoAsync(uri);
    if (fileInfo.exists) {
      await deleteAsync(uri);
    }
    return true;
  } catch {
    return false;
  }
}

export type MediaPickerResult =
  | { success: true; uri: string; type: "photo" | "video"; duration?: number }
  | { success: false; error: string; cancelled?: boolean };

const VIDEOS_DIRECTORY = `${documentDirectory}videos/`;

async function ensureVideosDirectory(): Promise<void> {
  const dirInfo = await getInfoAsync(VIDEOS_DIRECTORY);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(VIDEOS_DIRECTORY, { intermediates: true });
  }
}

async function saveVideoToDocuments(sourceUri: string): Promise<string> {
  await ensureVideosDirectory();

  const fileExtension = sourceUri.split(".").pop()?.toLowerCase() || "mp4";
  const fileName = `${generateId()}.${fileExtension}`;
  const destinationUri = `${VIDEOS_DIRECTORY}${fileName}`;

  await copyAsync({
    from: sourceUri,
    to: destinationUri,
  });

  return destinationUri;
}

/**
 * Pick media (photo or video) from the device library
 * Allows the user to select either photos or videos
 */
export async function pickMediaFromLibrary(): Promise<MediaPickerResult> {
  try {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      return { success: false, error: "Photo library permission denied" };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: false,
      quality: IMAGE_QUALITY,
      exif: false,
      videoMaxDuration: 300, // 5 minutes max
    });

    if (result.canceled) {
      return { success: false, error: "User cancelled", cancelled: true };
    }

    const asset = result.assets[0];
    if (!asset?.uri) {
      return { success: false, error: "No media selected" };
    }

    const isVideo = asset.type === "video";
    let savedUri: string;

    if (isVideo) {
      savedUri = await saveVideoToDocuments(asset.uri);
    } else {
      savedUri = await saveImageToDocuments(asset.uri);
    }

    return {
      success: true,
      uri: savedUri,
      type: isVideo ? "video" : "photo",
      duration: isVideo ? Math.round((asset.duration || 0) / 1000) : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to select media";
    return { success: false, error: message };
  }
}

/**
 * Pick only a photo from the device library
 */
export async function pickPhotoFromLibrary(): Promise<MediaPickerResult> {
  try {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      return { success: false, error: "Photo library permission denied" };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: IMAGE_QUALITY,
      exif: false,
    });

    if (result.canceled) {
      return { success: false, error: "User cancelled", cancelled: true };
    }

    const asset = result.assets[0];
    if (!asset?.uri) {
      return { success: false, error: "No photo selected" };
    }

    const savedUri = await saveImageToDocuments(asset.uri);
    return { success: true, uri: savedUri, type: "photo" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to select photo";
    return { success: false, error: message };
  }
}

/**
 * Pick only a video from the device library
 */
export async function pickVideoFromLibrary(): Promise<MediaPickerResult> {
  try {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      return { success: false, error: "Photo library permission denied" };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsEditing: false,
      quality: IMAGE_QUALITY,
      exif: false,
      videoMaxDuration: 300, // 5 minutes max
    });

    if (result.canceled) {
      return { success: false, error: "User cancelled", cancelled: true };
    }

    const asset = result.assets[0];
    if (!asset?.uri) {
      return { success: false, error: "No video selected" };
    }

    const savedUri = await saveVideoToDocuments(asset.uri);
    return {
      success: true,
      uri: savedUri,
      type: "video",
      duration: Math.round((asset.duration || 0) / 1000),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to select video";
    return { success: false, error: message };
  }
}
