import { useEffect, useState, useCallback } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

interface NetworkStatusResult {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string | null;
  refresh: () => Promise<void>;
}

export function useNetworkStatus(): NetworkStatusResult {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);
  const [type, setType] = useState<string | null>(null);

  const updateState = useCallback((state: NetInfoState) => {
    setIsConnected(state.isConnected);
    setIsInternetReachable(state.isInternetReachable);
    setType(state.type);
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
    isConnected,
    isInternetReachable,
    type,
    refresh,
  };
}
