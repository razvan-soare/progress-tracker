import { useCallback, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { Card, Button } from "@/components/ui";
import { colors } from "@/constants/colors";
import { useSyncSettingsStore } from "@/lib/store";
import { useBackgroundUpload } from "@/lib/sync/useBackgroundUpload";
import { useMediaCleanup } from "@/lib/sync/useMediaCleanup";
import {
  getSyncStats,
  getFailedUploads,
  getSyncHistory,
  retryFailedUpload,
  retryAllFailedUploads,
  clearLocalCache,
  getClearableCacheSize,
  formatBytes,
  addSyncHistoryEntry,
  type SyncStats,
  type FailedUpload,
} from "@/lib/sync";
import type { SyncHistoryEntry } from "@/types";

const RETENTION_OPTIONS = [
  { label: "1 day", value: 1 },
  { label: "3 days", value: 3 },
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
];

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "Just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case "success":
      return "✓";
    case "failed":
      return "✗";
    case "in_progress":
      return "⟳";
    default:
      return "•";
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "success":
      return colors.success;
    case "failed":
      return colors.error;
    case "in_progress":
      return colors.primary;
    default:
      return colors.textSecondary;
  }
}

function getOperationLabel(operationType: string): string {
  switch (operationType) {
    case "upload":
      return "Upload";
    case "download":
      return "Download";
    case "sync":
      return "Sync";
    case "retry":
      return "Retry";
    case "cache_clear":
      return "Cache Clear";
    default:
      return operationType;
  }
}

export default function SyncStorageScreen() {
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [failedUploads, setFailedUploads] = useState<FailedUpload[]>([]);
  const [history, setHistory] = useState<SyncHistoryEntry[]>([]);
  const [clearableSize, setClearableSize] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const isMounted = useRef(true);

  const {
    syncOnCellular,
    lastSuccessfulSync,
    autoCleanupEnabled,
    autoCleanupRetentionDays,
    keepThumbnailsLocally,
    lastAutoCleanup,
    totalBytesFreed,
    setSyncOnCellular,
    setLastSuccessfulSync,
    setAutoCleanupEnabled,
    setAutoCleanupRetentionDays,
    setKeepThumbnailsLocally,
  } = useSyncSettingsStore();

  const {
    isRunning,
    isPaused,
    pendingCount,
    currentProgress,
    checkPendingUploads,
  } = useBackgroundUpload({
    autoStart: true,
    onUploadCompleted: (entryId) => {
      if (isMounted.current) {
        loadData();
        setLastSuccessfulSync(new Date().toISOString());
      }
    },
    onUploadFailed: () => {
      if (isMounted.current) {
        loadData();
      }
    },
  });

  const {
    stats: cleanupStats,
    isCleanupInProgress,
    forceCleanup,
    refreshStats: refreshCleanupStats,
  } = useMediaCleanup({
    autoStart: true,
    onCleanupCompleted: (result) => {
      if (isMounted.current && result.bytesFreed > 0) {
        loadData();
        Alert.alert(
          "Auto-Cleanup Complete",
          `Freed ${formatBytes(result.bytesFreed)} by removing ${result.mediaFilesDeleted} media files.`
        );
      }
    },
  });

  const loadData = useCallback(async () => {
    try {
      const [syncStats, failed, syncHistory, clearable] = await Promise.all([
        getSyncStats(),
        getFailedUploads(),
        getSyncHistory(),
        getClearableCacheSize(),
      ]);

      if (isMounted.current) {
        setStats(syncStats);
        setFailedUploads(failed);
        setHistory(syncHistory);
        setClearableSize(clearable);
      }
    } catch (error) {
      console.error("Failed to load sync data:", error);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    setIsLoading(true);
    loadData().finally(() => {
      if (isMounted.current) {
        setIsLoading(false);
      }
    });

    return () => {
      isMounted.current = false;
    };
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }, [loadData]);

  const handleSyncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      await addSyncHistoryEntry("sync", "all", "in_progress", {
        message: "Manual sync initiated",
      });
      await checkPendingUploads();
      await loadData();
    } catch (error) {
      console.error("Failed to trigger sync:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [checkPendingUploads, loadData]);

  const handleRetryItem = useCallback(async (entryId: string) => {
    setRetryingIds((prev) => new Set(prev).add(entryId));
    try {
      const success = await retryFailedUpload(entryId);
      if (success) {
        await checkPendingUploads();
        await loadData();
      }
    } catch (error) {
      console.error("Failed to retry upload:", error);
    } finally {
      setRetryingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(entryId);
        return newSet;
      });
    }
  }, [checkPendingUploads, loadData]);

  const handleRetryAll = useCallback(async () => {
    Alert.alert(
      "Retry All Failed Uploads",
      `Retry all ${failedUploads.length} failed uploads?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Retry All",
          onPress: async () => {
            setIsSyncing(true);
            try {
              const count = await retryAllFailedUploads();
              if (count > 0) {
                await checkPendingUploads();
                await loadData();
              }
            } catch (error) {
              console.error("Failed to retry all:", error);
            } finally {
              setIsSyncing(false);
            }
          },
        },
      ]
    );
  }, [failedUploads.length, checkPendingUploads, loadData]);

  const handleClearCache = useCallback(async () => {
    if (clearableSize === 0) {
      Alert.alert("No Cache to Clear", "All uploaded media files have already been cleared from local storage.");
      return;
    }

    Alert.alert(
      "Clear Local Cache",
      `This will delete ${formatBytes(clearableSize)} of local media files that have been uploaded to the cloud. The cloud copies will remain intact.\n\nThis action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Cache",
          style: "destructive",
          onPress: async () => {
            setIsClearing(true);
            try {
              const result = await clearLocalCache();
              Alert.alert(
                "Cache Cleared",
                `Deleted ${result.deletedFiles} files and freed ${formatBytes(result.bytesFreed)} of storage.`
              );
              await loadData();
            } catch (error) {
              console.error("Failed to clear cache:", error);
              Alert.alert("Error", "Failed to clear cache. Please try again.");
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  }, [clearableSize, loadData]);

  const handleCellularToggle = useCallback((value: boolean) => {
    setSyncOnCellular(value);
    addSyncHistoryEntry("sync", "all", "success", {
      message: value ? "Cellular sync enabled" : "Cellular sync disabled (WiFi only)",
    });
  }, [setSyncOnCellular]);

  const handleAutoCleanupToggle = useCallback((value: boolean) => {
    setAutoCleanupEnabled(value);
    addSyncHistoryEntry("cache_clear", "media", "success", {
      message: value ? "Auto-cleanup enabled" : "Auto-cleanup disabled",
    });
  }, [setAutoCleanupEnabled]);

  const handleRetentionChange = useCallback((days: number) => {
    setAutoCleanupRetentionDays(days);
    addSyncHistoryEntry("cache_clear", "media", "success", {
      message: `Retention period set to ${days} day${days > 1 ? "s" : ""}`,
    });
  }, [setAutoCleanupRetentionDays]);

  const handleKeepThumbnailsToggle = useCallback((value: boolean) => {
    setKeepThumbnailsLocally(value);
    addSyncHistoryEntry("cache_clear", "media", "success", {
      message: value ? "Thumbnails will be kept locally" : "Thumbnails will be cleaned up",
    });
  }, [setKeepThumbnailsLocally]);

  const handleForceCleanup = useCallback(async () => {
    if (!cleanupStats || cleanupStats.eligibleCount === 0) {
      Alert.alert("Nothing to Clean", "No media files are eligible for cleanup yet. Files must be synced and past the retention period.");
      return;
    }

    Alert.alert(
      "Run Cleanup Now",
      `This will remove ${cleanupStats.eligibleCount} synced media files (${formatBytes(cleanupStats.eligibleBytes)}) that are past the ${autoCleanupRetentionDays}-day retention period.\n\nCloud copies will remain intact.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clean Now",
          onPress: async () => {
            try {
              const result = await forceCleanup();
              if (result.bytesFreed > 0) {
                Alert.alert(
                  "Cleanup Complete",
                  `Freed ${formatBytes(result.bytesFreed)} by removing ${result.mediaFilesDeleted} media files${result.thumbnailsDeleted > 0 ? ` and ${result.thumbnailsDeleted} thumbnails` : ""}.`
                );
              } else {
                Alert.alert("No Files Cleaned", "All eligible files were already cleaned or no files matched the criteria.");
              }
              await loadData();
              await refreshCleanupStats();
            } catch (error) {
              console.error("Failed to run cleanup:", error);
              Alert.alert("Error", "Failed to run cleanup. Please try again.");
            }
          },
        },
      ]
    );
  }, [cleanupStats, autoCleanupRetentionDays, forceCleanup, loadData, refreshCleanupStats]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: "Sync & Storage",
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.textPrimary,
          }}
        />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-text-secondary mt-4">Loading sync data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Sync & Storage",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Sync Status Overview */}
        <Card className="mt-4">
          <Text className="text-lg font-semibold text-text-primary mb-4">
            Sync Status
          </Text>

          <View className="flex-row justify-between mb-3">
            <View className="flex-1">
              <Text className="text-2xl font-bold text-success">
                {stats?.syncedCount ?? 0}
              </Text>
              <Text className="text-text-secondary text-sm">Synced</Text>
            </View>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-warning">
                {stats?.pendingCount ?? 0}
              </Text>
              <Text className="text-text-secondary text-sm">Pending</Text>
            </View>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-error">
                {stats?.failedCount ?? 0}
              </Text>
              <Text className="text-text-secondary text-sm">Failed</Text>
            </View>
          </View>

          {/* Current upload progress */}
          {isRunning && !isPaused && currentProgress !== null && (
            <View className="mt-3 pt-3 border-t border-border">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-text-secondary text-sm">Uploading...</Text>
                <Text className="text-primary text-sm font-medium">
                  {currentProgress}%
                </Text>
              </View>
              <View className="h-2 bg-surface rounded-full overflow-hidden">
                <View
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${currentProgress}%` }}
                />
              </View>
            </View>
          )}

          {isPaused && pendingCount > 0 && (
            <View className="mt-3 pt-3 border-t border-border">
              <Text className="text-warning text-sm">
                ⏸ Uploads paused (waiting for network)
              </Text>
            </View>
          )}

          {lastSuccessfulSync && (
            <View className="mt-3 pt-3 border-t border-border">
              <Text className="text-text-secondary text-sm">
                Last sync: {formatRelativeTime(lastSuccessfulSync)}
              </Text>
            </View>
          )}
        </Card>

        {/* Storage Overview */}
        <Card className="mt-4">
          <Text className="text-lg font-semibold text-text-primary mb-4">
            Storage
          </Text>

          <View className="flex-row justify-between">
            <View className="flex-1">
              <Text className="text-xl font-bold text-text-primary">
                {formatBytes(stats?.localStorageBytes ?? 0)}
              </Text>
              <Text className="text-text-secondary text-sm">Local</Text>
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-text-primary">
                {formatBytes(stats?.cloudStorageBytes ?? 0)}
              </Text>
              <Text className="text-text-secondary text-sm">Cloud (Est.)</Text>
            </View>
          </View>

          {clearableSize > 0 && (
            <View className="mt-3 pt-3 border-t border-border">
              <Text className="text-text-secondary text-sm">
                {formatBytes(clearableSize)} can be cleared from local storage
              </Text>
            </View>
          )}
        </Card>

        {/* Actions */}
        <Card className="mt-4">
          <Text className="text-lg font-semibold text-text-primary mb-4">
            Actions
          </Text>

          <Button
            title={isSyncing ? "Syncing..." : "Sync Now"}
            variant="primary"
            loading={isSyncing}
            onPress={handleSyncNow}
            className="mb-3"
            accessibilityLabel="Force sync now"
            accessibilityHint="Triggers an immediate sync attempt for pending uploads"
          />

          <Button
            title={isClearing ? "Clearing..." : "Clear Local Cache"}
            variant="secondary"
            loading={isClearing}
            disabled={clearableSize === 0}
            onPress={handleClearCache}
            accessibilityLabel="Clear local cache"
            accessibilityHint="Deletes local media files that have been uploaded to the cloud"
          />
        </Card>

        {/* Cellular Sync Setting */}
        <Card className="mt-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-base font-medium text-text-primary">
                Sync on Cellular
              </Text>
              <Text className="text-text-secondary text-sm mt-1">
                {syncOnCellular
                  ? "Sync over WiFi and cellular data"
                  : "Sync only when connected to WiFi"}
              </Text>
            </View>
            <Switch
              value={syncOnCellular}
              onValueChange={handleCellularToggle}
              trackColor={{ false: colors.surface, true: colors.primary }}
              thumbColor={colors.textPrimary}
              accessibilityLabel="Toggle cellular sync"
              accessibilityHint={
                syncOnCellular
                  ? "Currently syncing on cellular. Tap to disable."
                  : "Currently WiFi only. Tap to enable cellular sync."
              }
            />
          </View>
        </Card>

        {/* Auto Cleanup Settings */}
        <Card className="mt-4">
          <Text className="text-lg font-semibold text-text-primary mb-4">
            Automatic Cleanup
          </Text>

          {/* Auto-cleanup toggle */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1 pr-4">
              <Text className="text-base font-medium text-text-primary">
                Auto-cleanup Synced Media
              </Text>
              <Text className="text-text-secondary text-sm mt-1">
                {autoCleanupEnabled
                  ? "Automatically remove local media after sync"
                  : "Keep all media files locally"}
              </Text>
            </View>
            <Switch
              value={autoCleanupEnabled}
              onValueChange={handleAutoCleanupToggle}
              trackColor={{ false: colors.surface, true: colors.primary }}
              thumbColor={colors.textPrimary}
              accessibilityLabel="Toggle auto-cleanup"
              accessibilityHint={
                autoCleanupEnabled
                  ? "Auto-cleanup is enabled. Tap to disable."
                  : "Auto-cleanup is disabled. Tap to enable."
              }
            />
          </View>

          {autoCleanupEnabled && (
            <>
              {/* Retention period selector */}
              <View className="mb-4 pt-4 border-t border-border">
                <Text className="text-base font-medium text-text-primary mb-2">
                  Retention Period
                </Text>
                <Text className="text-text-secondary text-sm mb-3">
                  Keep synced media locally for this long before cleaning up
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {RETENTION_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => handleRetentionChange(option.value)}
                      className={`px-3 py-2 rounded-lg ${
                        autoCleanupRetentionDays === option.value
                          ? "bg-primary"
                          : "bg-surface"
                      }`}
                      accessibilityLabel={`Set retention to ${option.label}`}
                      accessibilityState={{ selected: autoCleanupRetentionDays === option.value }}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          autoCleanupRetentionDays === option.value
                            ? "text-white"
                            : "text-text-primary"
                        }`}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Keep thumbnails toggle */}
              <View className="flex-row items-center justify-between pt-4 border-t border-border">
                <View className="flex-1 pr-4">
                  <Text className="text-base font-medium text-text-primary">
                    Keep Thumbnails Locally
                  </Text>
                  <Text className="text-text-secondary text-sm mt-1">
                    {keepThumbnailsLocally
                      ? "Thumbnails kept for fast timeline loading"
                      : "Thumbnails will also be cleaned up"}
                  </Text>
                </View>
                <Switch
                  value={keepThumbnailsLocally}
                  onValueChange={handleKeepThumbnailsToggle}
                  trackColor={{ false: colors.surface, true: colors.primary }}
                  thumbColor={colors.textPrimary}
                  accessibilityLabel="Toggle keep thumbnails"
                  accessibilityHint={
                    keepThumbnailsLocally
                      ? "Thumbnails will be kept. Tap to include in cleanup."
                      : "Thumbnails will be cleaned. Tap to keep them."
                  }
                />
              </View>
            </>
          )}

          {/* Cleanup stats */}
          <View className="mt-4 pt-4 border-t border-border">
            <View className="flex-row justify-between mb-3">
              <View className="flex-1">
                <Text className="text-xl font-bold text-text-primary">
                  {cleanupStats?.eligibleCount ?? 0}
                </Text>
                <Text className="text-text-secondary text-sm">Ready to clean</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xl font-bold text-text-primary">
                  {formatBytes(cleanupStats?.eligibleBytes ?? 0)}
                </Text>
                <Text className="text-text-secondary text-sm">Can be freed</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xl font-bold text-success">
                  {formatBytes(totalBytesFreed)}
                </Text>
                <Text className="text-text-secondary text-sm">Total saved</Text>
              </View>
            </View>

            {lastAutoCleanup && (
              <Text className="text-text-secondary text-sm mb-3">
                Last auto-cleanup: {formatRelativeTime(lastAutoCleanup)}
              </Text>
            )}

            <Button
              title={isCleanupInProgress ? "Cleaning..." : "Run Cleanup Now"}
              variant="secondary"
              loading={isCleanupInProgress}
              disabled={!cleanupStats || cleanupStats.eligibleCount === 0}
              onPress={handleForceCleanup}
              accessibilityLabel="Run cleanup now"
              accessibilityHint="Manually trigger cleanup for eligible media files"
            />
          </View>
        </Card>

        {/* Failed Uploads */}
        {failedUploads.length > 0 && (
          <Card className="mt-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold text-text-primary">
                Failed Uploads ({failedUploads.length})
              </Text>
              <Pressable
                onPress={handleRetryAll}
                className="px-3 py-1 bg-error/20 rounded-lg active:opacity-80"
                accessibilityLabel="Retry all failed uploads"
              >
                <Text className="text-error text-sm font-medium">Retry All</Text>
              </Pressable>
            </View>

            {failedUploads.map((item, index) => (
              <View
                key={item.entry.id}
                className={`flex-row items-center justify-between py-3 ${
                  index > 0 ? "border-t border-border" : ""
                }`}
              >
                <View className="flex-1 pr-3">
                  <Text className="text-text-primary text-sm" numberOfLines={1}>
                    {item.entry.entryType.charAt(0).toUpperCase() +
                      item.entry.entryType.slice(1)}{" "}
                    - {formatRelativeTime(item.entry.createdAt)}
                  </Text>
                  {item.errorMessage && (
                    <Text
                      className="text-error text-xs mt-1"
                      numberOfLines={2}
                    >
                      {item.errorMessage}
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={() => handleRetryItem(item.entry.id)}
                  disabled={retryingIds.has(item.entry.id)}
                  className="px-3 py-2 bg-primary rounded-lg active:opacity-80"
                  accessibilityLabel={`Retry upload for ${item.entry.entryType}`}
                >
                  {retryingIds.has(item.entry.id) ? (
                    <ActivityIndicator size="small" color={colors.textPrimary} />
                  ) : (
                    <Text className="text-white text-sm font-medium">Retry</Text>
                  )}
                </Pressable>
              </View>
            ))}
          </Card>
        )}

        {/* Sync History */}
        <Card className="mt-4">
          <Text className="text-lg font-semibold text-text-primary mb-4">
            Sync History
          </Text>

          {history.length === 0 ? (
            <Text className="text-text-secondary text-center py-4">
              No sync history yet
            </Text>
          ) : (
            history.slice(0, 20).map((item, index) => (
              <View
                key={item.id}
                className={`flex-row items-start py-2 ${
                  index > 0 ? "border-t border-border" : ""
                }`}
              >
                <Text
                  className="text-base mr-2"
                  style={{ color: getStatusColor(item.status) }}
                >
                  {getStatusIcon(item.status)}
                </Text>
                <View className="flex-1">
                  <Text className="text-text-primary text-sm">
                    {getOperationLabel(item.operationType)}
                    {item.bytesTransferred > 0 &&
                      ` - ${formatBytes(item.bytesTransferred)}`}
                  </Text>
                  {item.message && (
                    <Text className="text-text-secondary text-xs mt-0.5">
                      {item.message}
                    </Text>
                  )}
                </View>
                <Text className="text-text-secondary text-xs">
                  {formatRelativeTime(item.createdAt)}
                </Text>
              </View>
            ))
          )}

          {history.length > 20 && (
            <Text className="text-text-secondary text-center text-sm pt-3 border-t border-border mt-2">
              Showing 20 of {history.length} entries
            </Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
