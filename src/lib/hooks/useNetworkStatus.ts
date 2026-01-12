import { useEffect, useState, useCallback } from "react";
import NetInfo, { NetInfoState, NetInfoStateType } from "@react-native-community/netinfo";

export type ConnectionType = "wifi" | "cellular" | "none";

export interface NetworkStatusResult {
  isOnline: boolean;
  connectionType: ConnectionType;
  isConnectionStable: boolean;
  isInternetReachable: boolean | null;
  refresh: () => Promise<void>;
}

function mapConnectionType(type: NetInfoStateType): ConnectionType {
  switch (type) {
    case "wifi":
      return "wifi";
    case "cellular":
      return "cellular";
    default:
      return "none";
  }
}

function isConnectionStable(state: NetInfoState): boolean {
  if (!state.isConnected || !state.isInternetReachable) {
    return false;
  }

  // Check effective connection type for cellular connections
  if (state.type === "cellular" && state.details) {
    const cellularDetails = state.details as { cellularGeneration?: string };
    const generation = cellularDetails.cellularGeneration;
    // Consider 4g and 5g as stable connections
    return generation === "4g" || generation === "5g";
  }

  // WiFi is considered stable if internet is reachable
  if (state.type === "wifi") {
    return true;
  }

  return false;
}

export function useNetworkStatus(): NetworkStatusResult {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [connectionType, setConnectionType] = useState<ConnectionType>("none");
  const [isStable, setIsStable] = useState<boolean>(false);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);

  const updateState = useCallback((state: NetInfoState) => {
    const online = state.isConnected === true && state.isInternetReachable !== false;
    setIsOnline(online);
    setConnectionType(mapConnectionType(state.type));
    setIsStable(isConnectionStable(state));
    setIsInternetReachable(state.isInternetReachable);
  }, []);

  const refresh = useCallback(async () => {
    const state = await NetInfo.fetch();
    updateState(state);
  }, [updateState]);

  useEffect(() => {
    // Get initial state
    NetInfo.fetch().then(updateState);

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(updateState);

    return () => unsubscribe();
  }, [updateState]);

  return {
    isOnline,
    connectionType,
    isConnectionStable: isStable,
    isInternetReachable,
    refresh,
  };
}
