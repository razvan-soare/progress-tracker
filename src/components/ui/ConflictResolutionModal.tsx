import { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { colors } from "@/constants/colors";
import type { SyncConflict, ConflictResolution, Entry } from "@/types";
import { formatDateTime } from "@/lib/utils/date";

export interface ConflictResolutionModalProps {
  visible: boolean;
  conflict: SyncConflict | null;
  onResolve: (resolution: ConflictResolution) => Promise<void>;
  onCancel: () => void;
}

function formatEntryPreview(entry: Entry): string {
  if (entry.contentText) {
    return entry.contentText.length > 100
      ? entry.contentText.substring(0, 100) + "..."
      : entry.contentText;
  }
  if (entry.entryType === "photo") {
    return "Photo entry";
  }
  if (entry.entryType === "video") {
    return `Video entry (${entry.durationSeconds ? Math.round(entry.durationSeconds) + "s" : "unknown duration"})`;
  }
  return "Entry";
}

function EntryPreviewCard({
  entry,
  label,
  isLocal,
}: {
  entry: Entry;
  label: string;
  isLocal: boolean;
}) {
  return (
    <View className="bg-surface border border-border rounded-lg p-4 mb-3">
      <View className="flex-row items-center mb-2">
        <Text className="text-base mr-2">{isLocal ? "📱" : "☁️"}</Text>
        <Text className="text-white font-semibold">{label}</Text>
      </View>
      <Text className="text-textSecondary text-sm mb-2">
        {formatEntryPreview(entry)}
      </Text>
      <View className="flex-row items-center">
        <Text className="text-xs mr-1">🕐</Text>
        <Text className="text-textSecondary text-xs">
          Updated: {formatDateTime(new Date(entry.updatedAt))}
        </Text>
      </View>
    </View>
  );
}

export function ConflictResolutionModal({
  visible,
  conflict,
  onResolve,
  onCancel,
}: ConflictResolutionModalProps) {
  const [isResolving, setIsResolving] = useState(false);
  const [selectedResolution, setSelectedResolution] =
    useState<ConflictResolution | null>(null);

  const handleResolve = async (resolution: ConflictResolution) => {
    setSelectedResolution(resolution);
    setIsResolving(true);
    try {
      await onResolve(resolution);
    } finally {
      setIsResolving(false);
      setSelectedResolution(null);
    }
  };

  if (!conflict) {
    return null;
  }

  const isDeleteConflict = conflict.conflictType === "delete_edit";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1 bg-black/80 justify-center items-center px-4">
        <View className="bg-background w-full max-w-md rounded-2xl overflow-hidden">
          {/* Header */}
          <View className="bg-surface px-5 py-4 flex-row items-center justify-between border-b border-border">
            <View className="flex-row items-center">
              <Text className="text-xl mr-2">⚠️</Text>
              <Text className="text-white text-lg font-bold">
                Sync Conflict
              </Text>
            </View>
            <Pressable
              onPress={onCancel}
              disabled={isResolving}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="p-2"
            >
              <Text
                className={`text-xl ${isResolving ? "opacity-50" : ""}`}
              >
                ✕
              </Text>
            </Pressable>
          </View>

          <ScrollView className="max-h-96">
            <View className="p-5">
              {/* Conflict explanation */}
              <Text className="text-textSecondary text-sm mb-4">
                {isDeleteConflict
                  ? "This entry was deleted on another device, but you have made local changes. Choose how to resolve this conflict."
                  : "This entry was modified on another device while you also made changes locally. Choose which version to keep."}
              </Text>

              {/* Entry previews */}
              <EntryPreviewCard
                entry={conflict.localEntry}
                label="Your Local Version"
                isLocal
              />

              {conflict.remoteEntry && (
                <EntryPreviewCard
                  entry={conflict.remoteEntry}
                  label="Remote Version"
                  isLocal={false}
                />
              )}

              {isDeleteConflict && !conflict.remoteEntry && (
                <View className="bg-error/20 border border-error/40 rounded-lg p-4 mb-3">
                  <View className="flex-row items-center">
                    <Text className="text-base mr-2">🗑️</Text>
                    <Text className="text-error font-semibold">
                      Deleted on Remote
                    </Text>
                  </View>
                  <Text className="text-textSecondary text-sm mt-2">
                    This entry no longer exists on the server.
                  </Text>
                </View>
              )}

              {/* Timestamp comparison */}
              {conflict.remoteEntry && (
                <View className="bg-surface/50 rounded-lg p-3 mb-4">
                  <Text className="text-textSecondary text-xs text-center">
                    Local: {formatDateTime(new Date(conflict.localUpdatedAt))} vs Remote:{" "}
                    {conflict.remoteUpdatedAt
                      ? formatDateTime(new Date(conflict.remoteUpdatedAt))
                      : "Deleted"}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Action buttons */}
          <View className="p-5 pt-0">
            {/* Keep Local */}
            <ResolutionButton
              title="Keep Local"
              subtitle={
                isDeleteConflict
                  ? "Preserve your local changes and re-upload"
                  : "Keep your local version and overwrite remote"
              }
              icon="📱"
              onPress={() => handleResolve("keep_local")}
              isLoading={isResolving && selectedResolution === "keep_local"}
              disabled={isResolving}
              recommended={isDeleteConflict}
            />

            {/* Keep Remote */}
            <ResolutionButton
              title="Keep Remote"
              subtitle={
                isDeleteConflict
                  ? "Accept deletion and remove local entry"
                  : "Accept remote version and discard local changes"
              }
              icon="☁️"
              onPress={() => handleResolve("keep_remote")}
              isLoading={isResolving && selectedResolution === "keep_remote"}
              disabled={isResolving}
            />

            {/* Keep Both - only for concurrent edits */}
            {!isDeleteConflict && (
              <ResolutionButton
                title="Keep Both"
                subtitle="Create a duplicate with your local changes"
                icon="📄"
                onPress={() => handleResolve("keep_both")}
                isLoading={isResolving && selectedResolution === "keep_both"}
                disabled={isResolving}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface ResolutionButtonProps {
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
  isLoading: boolean;
  disabled: boolean;
  recommended?: boolean;
}

function ResolutionButton({
  title,
  subtitle,
  icon,
  onPress,
  isLoading,
  disabled,
  recommended,
}: ResolutionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`bg-surface border rounded-xl p-4 flex-row items-center mb-3 active:opacity-80 ${
        disabled ? "opacity-50" : ""
      } ${recommended ? "border-primary" : "border-border"}`}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
    >
      <View className="w-10 h-10 rounded-full items-center justify-center mr-3 bg-background">
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text className="text-xl">{icon}</Text>
        )}
      </View>
      <View className="flex-1">
        <View className="flex-row items-center">
          <Text className="text-white font-semibold">{title}</Text>
          {recommended && (
            <View className="bg-primary/20 px-2 py-0.5 rounded ml-2">
              <Text className="text-primary text-xs font-medium">Recommended</Text>
            </View>
          )}
        </View>
        <Text className="text-textSecondary text-xs mt-0.5">{subtitle}</Text>
      </View>
      <Text className="text-textSecondary text-lg">›</Text>
    </Pressable>
  );
}
