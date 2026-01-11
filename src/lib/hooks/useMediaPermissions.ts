import { useState, useEffect, useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "expo-camera";
import { Audio } from "expo-av";
import { Linking, Platform, AppState, AppStateStatus } from "react-native";

export type PermissionStatus = "undetermined" | "granted" | "denied" | "limited";

export interface MediaPermissions {
  camera: PermissionStatus;
  microphone: PermissionStatus;
  mediaLibrary: PermissionStatus;
}

export interface UseMediaPermissionsResult {
  permissions: MediaPermissions;
  isLoading: boolean;
  hasAllRequired: (required: (keyof MediaPermissions)[]) => boolean;
  checkPermissions: () => Promise<void>;
  requestCameraPermission: () => Promise<boolean>;
  requestMicrophonePermission: () => Promise<boolean>;
  requestMediaLibraryPermission: () => Promise<boolean>;
  requestAllPermissions: (required: (keyof MediaPermissions)[]) => Promise<boolean>;
  openSettings: () => Promise<void>;
}

function mapPermissionStatus(status: string): PermissionStatus {
  switch (status) {
    case "granted":
      return "granted";
    case "denied":
      return "denied";
    case "limited":
      return "limited";
    default:
      return "undetermined";
  }
}

export function useMediaPermissions(): UseMediaPermissionsResult {
  const [permissions, setPermissions] = useState<MediaPermissions>({
    camera: "undetermined",
    microphone: "undetermined",
    mediaLibrary: "undetermined",
  });
  const [isLoading, setIsLoading] = useState(true);

  const checkPermissions = useCallback(async () => {
    setIsLoading(true);

    try {
      const [cameraResult, microphoneResult, mediaLibraryResult] = await Promise.all([
        Camera.getCameraPermissionsAsync(),
        Audio.getPermissionsAsync(),
        ImagePicker.getMediaLibraryPermissionsAsync(),
      ]);

      setPermissions({
        camera: mapPermissionStatus(cameraResult.status),
        microphone: mapPermissionStatus(microphoneResult.status),
        mediaLibrary: mapPermissionStatus(mediaLibraryResult.status),
      });
    } catch {
      // Keep current state on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  const hasAllRequired = useCallback(
    (required: (keyof MediaPermissions)[]) => {
      return required.every(
        (permission) =>
          permissions[permission] === "granted" ||
          permissions[permission] === "limited"
      );
    },
    [permissions]
  );

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      const mappedStatus = mapPermissionStatus(status);

      setPermissions((prev) => ({
        ...prev,
        camera: mappedStatus,
      }));

      return mappedStatus === "granted" || mappedStatus === "limited";
    } catch {
      return false;
    }
  }, []);

  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      const mappedStatus = mapPermissionStatus(status);

      setPermissions((prev) => ({
        ...prev,
        microphone: mappedStatus,
      }));

      return mappedStatus === "granted" || mappedStatus === "limited";
    } catch {
      return false;
    }
  }, []);

  const requestMediaLibraryPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const mappedStatus = mapPermissionStatus(status);

      setPermissions((prev) => ({
        ...prev,
        mediaLibrary: mappedStatus,
      }));

      return mappedStatus === "granted" || mappedStatus === "limited";
    } catch {
      return false;
    }
  }, []);

  const requestAllPermissions = useCallback(
    async (required: (keyof MediaPermissions)[]): Promise<boolean> => {
      const results: boolean[] = [];

      for (const permission of required) {
        let result = false;

        switch (permission) {
          case "camera":
            result = await requestCameraPermission();
            break;
          case "microphone":
            result = await requestMicrophonePermission();
            break;
          case "mediaLibrary":
            result = await requestMediaLibraryPermission();
            break;
        }

        results.push(result);
      }

      return results.every(Boolean);
    },
    [requestCameraPermission, requestMicrophonePermission, requestMediaLibraryPermission]
  );

  const openSettings = useCallback(async () => {
    try {
      if (Platform.OS === "ios") {
        await Linking.openURL("app-settings:");
      } else {
        await Linking.openSettings();
      }
    } catch {
      // Settings could not be opened
    }
  }, []);

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // Re-check permissions when app returns from background (user may have changed settings)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        checkPermissions();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [checkPermissions]);

  return {
    permissions,
    isLoading,
    hasAllRequired,
    checkPermissions,
    requestCameraPermission,
    requestMicrophonePermission,
    requestMediaLibraryPermission,
    requestAllPermissions,
    openSettings,
  };
}
