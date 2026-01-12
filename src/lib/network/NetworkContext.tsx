import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import NetInfo, { NetInfoState, NetInfoStateType } from "@react-native-community/netinfo";

export type ConnectionType = "wifi" | "cellular" | "none";

interface NetworkState {
  isOnline: boolean;
  connectionType: ConnectionType;
  isConnectionStable: boolean;
  isInternetReachable: boolean | null;
}

interface NetworkMethods {
  refresh: () => Promise<void>;
}

type NetworkContextType = NetworkState & NetworkMethods;

const NetworkContext = createContext<NetworkContextType | null>(null);

interface NetworkProviderProps {
  children: ReactNode;
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

function calculateIsConnectionStable(state: NetInfoState): boolean {
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

export function NetworkProvider({ children }: NetworkProviderProps) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [connectionType, setConnectionType] = useState<ConnectionType>("none");
  const [isConnectionStable, setIsConnectionStable] = useState<boolean>(false);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);

  const updateState = useCallback((state: NetInfoState) => {
    const online = state.isConnected === true && state.isInternetReachable !== false;
    setIsOnline(online);
    setConnectionType(mapConnectionType(state.type));
    setIsConnectionStable(calculateIsConnectionStable(state));
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

  const value = useMemo<NetworkContextType>(
    () => ({
      isOnline,
      connectionType,
      isConnectionStable,
      isInternetReachable,
      refresh,
    }),
    [isOnline, connectionType, isConnectionStable, isInternetReachable, refresh]
  );

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}

/**
 * Hook to access the network context.
 * Must be used within a NetworkProvider.
 */
export function useNetwork(): NetworkContextType {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}

/**
 * Hook to check if the device is online.
 * Convenience hook for components that only need online status.
 */
export function useIsOnline(): boolean {
  const { isOnline } = useNetwork();
  return isOnline;
}

/**
 * Hook to get the current connection type.
 * Convenience hook for components that only need connection type.
 */
export function useConnectionType(): ConnectionType {
  const { connectionType } = useNetwork();
  return connectionType;
}

/**
 * Hook to check if the connection is stable.
 * Convenience hook for components that need connection quality info.
 */
export function useIsConnectionStable(): boolean {
  const { isConnectionStable } = useNetwork();
  return isConnectionStable;
}
