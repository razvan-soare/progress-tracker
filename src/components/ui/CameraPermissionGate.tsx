import { ReactNode, useCallback, useState } from "react";
import { View } from "react-native";
import { useMediaPermissions, MediaPermissions } from "@/lib/hooks";
import { PermissionRequest, PermissionType } from "./PermissionRequest";
import { PermissionDenied, DeniedPermissionType } from "./PermissionDenied";
import { LoadingSpinner } from "./LoadingSpinner";

type RequiredPermission = keyof MediaPermissions;

interface CameraPermissionGateProps {
  children: ReactNode;
  requiredPermissions?: RequiredPermission[];
  onPermissionGranted?: () => void;
  onCancel?: () => void;
  compact?: boolean;
}

function getPermissionType(permissions: RequiredPermission[]): PermissionType {
  const hasCamera = permissions.includes("camera");
  const hasMicrophone = permissions.includes("microphone");
  const hasMediaLibrary = permissions.includes("mediaLibrary");

  if (hasCamera && hasMicrophone) {
    return "cameraAndMicrophone";
  }
  if (hasCamera) {
    return "camera";
  }
  if (hasMicrophone) {
    return "microphone";
  }
  if (hasMediaLibrary) {
    return "mediaLibrary";
  }

  return "camera";
}

function getDeniedPermissionType(permissions: RequiredPermission[]): DeniedPermissionType {
  const hasCamera = permissions.includes("camera");
  const hasMicrophone = permissions.includes("microphone");
  const hasMediaLibrary = permissions.includes("mediaLibrary");

  if (hasCamera && hasMicrophone) {
    return "cameraAndMicrophone";
  }
  if (hasCamera) {
    return "camera";
  }
  if (hasMicrophone) {
    return "microphone";
  }
  if (hasMediaLibrary) {
    return "mediaLibrary";
  }

  return "camera";
}

export function CameraPermissionGate({
  children,
  requiredPermissions = ["camera"],
  onPermissionGranted,
  onCancel,
  compact = false,
}: CameraPermissionGateProps) {
  const {
    permissions,
    isLoading,
    hasAllRequired,
    requestAllPermissions,
    openSettings,
  } = useMediaPermissions();

  const [isRequesting, setIsRequesting] = useState(false);

  const allGranted = hasAllRequired(requiredPermissions);

  const hasDenied = requiredPermissions.some(
    (permission) => permissions[permission] === "denied"
  );

  const handleRequestPermission = useCallback(async () => {
    setIsRequesting(true);

    const granted = await requestAllPermissions(requiredPermissions);

    setIsRequesting(false);

    if (granted) {
      onPermissionGranted?.();
    }
  }, [requiredPermissions, requestAllPermissions, onPermissionGranted]);

  const handleOpenSettings = useCallback(() => {
    openSettings();
  }, [openSettings]);

  // Show loading while checking initial permission status
  if (isLoading) {
    if (compact) {
      return (
        <View className="bg-surface rounded-xl p-4 items-center justify-center min-h-[120px]">
          <LoadingSpinner size="small" />
        </View>
      );
    }
    return (
      <View className="flex-1 items-center justify-center">
        <LoadingSpinner />
      </View>
    );
  }

  // All permissions granted - render children
  if (allGranted) {
    return <>{children}</>;
  }

  // Permission was denied - show settings prompt
  if (hasDenied) {
    return (
      <PermissionDenied
        permissionType={getDeniedPermissionType(requiredPermissions)}
        onOpenSettings={handleOpenSettings}
        onCancel={onCancel}
        compact={compact}
      />
    );
  }

  // Permission not yet requested - show request prompt
  return (
    <PermissionRequest
      permissionType={getPermissionType(requiredPermissions)}
      onRequestPermission={handleRequestPermission}
      loading={isRequesting}
      compact={compact}
    />
  );
}
