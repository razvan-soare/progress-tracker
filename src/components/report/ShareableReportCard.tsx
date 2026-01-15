import { forwardRef } from "react";
import { View, Text, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Entry, Report, Project } from "@/types";

function formatMonthName(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  const date = new Date(year, monthNum - 1, 1);
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function formatShortDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getDayNumber(entry: Entry, month: string): number {
  const entryDate = new Date(entry.createdAt);
  const [year, monthNum] = month.split("-").map(Number);
  const firstDayOfMonth = new Date(year, monthNum - 1, 1);

  const diffTime = entryDate.getTime() - firstDayOfMonth.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

  return Math.max(1, diffDays);
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

interface EntryThumbnailProps {
  entry: Entry | null;
  label: string;
  isDeleted?: boolean;
}

function EntryThumbnail({ entry, label, isDeleted }: EntryThumbnailProps) {
  const renderContent = () => {
    if (isDeleted || !entry) {
      return (
        <View
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#1a1a1a",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 32, opacity: 0.3, marginBottom: 8 }}>
            🗑️
          </Text>
          <Text
            style={{
              color: "#a1a1aa",
              fontSize: 11,
              textAlign: "center",
              paddingHorizontal: 8,
            }}
          >
            Entry deleted
          </Text>
        </View>
      );
    }

    switch (entry.entryType) {
      case "video":
        return (
          <View style={{ width: "100%", height: "100%", position: "relative" }}>
            {entry.thumbnailUri ? (
              <Image
                source={{ uri: entry.thumbnailUri }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : entry.mediaUri ? (
              <Image
                source={{ uri: entry.mediaUri }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={["#3b82f6", "#6366f1"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: "100%",
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 40, opacity: 0.5 }}>🎬</Text>
              </LinearGradient>
            )}
            {/* Play icon overlay */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "white", fontSize: 16, marginLeft: 2 }}>
                  ▶
                </Text>
              </View>
            </View>
            {/* Duration badge */}
            {entry.durationSeconds && (
              <View
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  backgroundColor: "rgba(0,0,0,0.7)",
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 4,
                }}
              >
                <Text
                  style={{
                    color: "white",
                    fontSize: 11,
                    fontWeight: "500",
                  }}
                >
                  {formatShortDuration(entry.durationSeconds)}
                </Text>
              </View>
            )}
          </View>
        );

      case "photo":
        return entry.thumbnailUri || entry.mediaUri ? (
          <Image
            source={{ uri: entry.thumbnailUri || entry.mediaUri }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={["#ec4899", "#f43f5e"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: "100%",
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 40, opacity: 0.5 }}>📷</Text>
          </LinearGradient>
        );

      case "text":
        return (
          <View
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#1a1a1a",
              padding: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 18 }}>📝</Text>
            </View>
            {entry.contentText ? (
              <Text
                style={{
                  color: "#a1a1aa",
                  fontSize: 12,
                  lineHeight: 18,
                }}
                numberOfLines={4}
              >
                {truncateText(entry.contentText, 80)}
              </Text>
            ) : (
              <Text
                style={{
                  color: "#a1a1aa",
                  fontSize: 12,
                  fontStyle: "italic",
                  opacity: 0.5,
                }}
              >
                Empty note
              </Text>
            )}
          </View>
        );

      default:
        return (
          <View
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#1a1a1a",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 32, opacity: 0.5 }}>📄</Text>
          </View>
        );
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: "#1a1a1a",
          aspectRatio: 1,
        }}
      >
        {renderContent()}
      </View>
      <Text
        style={{
          color: "#a1a1aa",
          fontSize: 12,
          textAlign: "center",
          marginTop: 8,
          fontWeight: "500",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

interface StatBadgeProps {
  icon: string;
  value: string | number;
  label: string;
}

function StatBadge({ icon, value, label }: StatBadgeProps) {
  return (
    <View
      style={{
        backgroundColor: "#1a1a1a",
        borderRadius: 12,
        padding: 12,
        flex: 1,
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 20, marginBottom: 4 }}>{icon}</Text>
      <Text
        style={{
          color: "#ffffff",
          fontSize: 16,
          fontWeight: "700",
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: "#a1a1aa",
          fontSize: 10,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

interface EntryTypeBadgeProps {
  icon: string;
  count: number;
  label: string;
  color: string;
}

function EntryTypeBadge({ icon, count, label, color }: EntryTypeBadgeProps) {
  if (count === 0) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: `${color}33`,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
      }}
    >
      <Text style={{ color, fontSize: 11, marginRight: 4 }}>{icon}</Text>
      <Text style={{ color, fontSize: 11, fontWeight: "500" }}>
        {count} {label}
      </Text>
    </View>
  );
}

export interface ShareableReportCardProps {
  report: Report;
  project: Project | null;
  firstEntry: Entry | null;
  lastEntry: Entry | null;
  firstEntryDeleted?: boolean;
  lastEntryDeleted?: boolean;
  comparisonOnly?: boolean;
}

export const ShareableReportCard = forwardRef<View, ShareableReportCardProps>(
  (
    {
      report,
      project,
      firstEntry,
      lastEntry,
      firstEntryDeleted,
      lastEntryDeleted,
      comparisonOnly = false,
    },
    ref
  ) => {
    const firstDayLabel = firstEntry
      ? `Day ${getDayNumber(firstEntry, report.month)}`
      : "Day 1";

    const lastDayLabel = lastEntry
      ? `Day ${getDayNumber(lastEntry, report.month)}`
      : report.totalEntries
        ? `Day ${report.totalEntries}`
        : "Last Day";

    const getDaysActive = (report: Report): number => {
      return Math.min(report.totalEntries, 30);
    };

    if (comparisonOnly) {
      // Render only the comparison images side-by-side
      return (
        <View
          ref={ref}
          style={{
            backgroundColor: "#0a0a0a",
            padding: 20,
            width: 400,
          }}
          collapsable={false}
        >
          {/* Header */}
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            {project?.name && (
              <Text
                style={{
                  color: "#ffffff",
                  fontSize: 16,
                  fontWeight: "600",
                  marginBottom: 4,
                }}
              >
                {project.name}
              </Text>
            )}
            <Text
              style={{
                color: "#a1a1aa",
                fontSize: 13,
              }}
            >
              {formatMonthName(report.month)}
            </Text>
          </View>

          {/* Side-by-Side Comparison */}
          <View
            style={{
              flexDirection: "row",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <EntryThumbnail
              entry={firstEntry}
              label={firstDayLabel}
              isDeleted={firstEntryDeleted}
            />

            {/* Arrow between entries */}
            <View
              style={{
                justifyContent: "center",
                alignItems: "center",
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ color: "#a1a1aa", fontSize: 24 }}>→</Text>
            </View>

            <EntryThumbnail
              entry={lastEntry}
              label={lastDayLabel}
              isDeleted={lastEntryDeleted}
            />
          </View>

          {/* Branding */}
          <View
            style={{
              alignItems: "center",
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: "#2a2a2a",
            }}
          >
            <Text
              style={{
                color: "#6366f1",
                fontSize: 11,
                fontWeight: "500",
              }}
            >
              Progress Tracker
            </Text>
          </View>
        </View>
      );
    }

    // Full report card with stats
    return (
      <View
        ref={ref}
        style={{
          backgroundColor: "#0a0a0a",
          padding: 24,
          width: 400,
        }}
        collapsable={false}
      >
        {/* Header */}
        <View style={{ alignItems: "center", marginBottom: 20 }}>
          <Text
            style={{
              color: "#ffffff",
              fontSize: 22,
              fontWeight: "700",
              marginBottom: 4,
            }}
          >
            {formatMonthName(report.month)}
          </Text>
          {project?.name && (
            <View
              style={{
                backgroundColor: "#1a1a1a",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                marginTop: 8,
              }}
            >
              <Text
                style={{
                  color: "#a1a1aa",
                  fontSize: 12,
                }}
              >
                {project.name}
              </Text>
            </View>
          )}
        </View>

        {/* Progress Comparison Section */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              color: "#a1a1aa",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 12,
              fontWeight: "500",
            }}
          >
            Progress Comparison
          </Text>

          <View
            style={{
              flexDirection: "row",
              gap: 16,
            }}
          >
            <EntryThumbnail
              entry={firstEntry}
              label={firstDayLabel}
              isDeleted={firstEntryDeleted}
            />

            {/* Arrow between entries */}
            <View
              style={{
                justifyContent: "center",
                alignItems: "center",
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ color: "#a1a1aa", fontSize: 24 }}>→</Text>
            </View>

            <EntryThumbnail
              entry={lastEntry}
              label={lastDayLabel}
              isDeleted={lastEntryDeleted}
            />
          </View>
        </View>

        {/* Statistics Section */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              color: "#a1a1aa",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 12,
              fontWeight: "500",
            }}
          >
            Monthly Statistics
          </Text>

          {/* Entry breakdown badges */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <EntryTypeBadge
              icon="🎬"
              count={report.totalVideos}
              label={report.totalVideos === 1 ? "video" : "videos"}
              color="#6366f1"
            />
            <EntryTypeBadge
              icon="📷"
              count={report.totalPhotos}
              label={report.totalPhotos === 1 ? "photo" : "photos"}
              color="#22c55e"
            />
            <EntryTypeBadge
              icon="📝"
              count={report.totalTextEntries}
              label={report.totalTextEntries === 1 ? "note" : "notes"}
              color="#f59e0b"
            />
          </View>

          {/* Stats row */}
          <View
            style={{
              flexDirection: "row",
              gap: 12,
            }}
          >
            <StatBadge
              icon="📊"
              value={report.totalEntries}
              label="Total Entries"
            />
            <StatBadge
              icon="⏱️"
              value={formatDuration(report.totalDurationSeconds)}
              label="Video Time"
            />
            <StatBadge
              icon="📅"
              value={getDaysActive(report)}
              label="Days Active"
            />
          </View>
        </View>

        {/* Branding */}
        <View
          style={{
            alignItems: "center",
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: "#2a2a2a",
          }}
        >
          <Text
            style={{
              color: "#6366f1",
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            Progress Tracker
          </Text>
        </View>
      </View>
    );
  }
);

ShareableReportCard.displayName = "ShareableReportCard";
