import { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { useRouter, Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { EntryThumbnail } from "@/components/entry";
import { IconButton } from "@/components/ui";
import { colors } from "@/constants/colors";
import type { Entry, Project, ProjectCategory } from "@/types";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CATEGORY_GRADIENTS: Record<ProjectCategory, [string, string]> = {
  fitness: ["#ef4444", "#f97316"],
  learning: ["#3b82f6", "#6366f1"],
  creative: ["#ec4899", "#a855f7"],
  custom: ["#6366f1", "#8b5cf6"],
};

interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  dateKey: string;
}

export interface CrossProjectCalendarViewProps {
  entries: Entry[];
  projects: Project[];
  onEntryPress?: (entryId: string) => void;
}

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function generateCalendarDays(year: number, month: number): CalendarDay[] {
  const days: CalendarDay[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();
  const todayKey = getDateKey(today);

  // Days from previous month to fill first week
  const firstDayOfWeek = firstDay.getDay();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    days.push({
      date,
      dayOfMonth: date.getDate(),
      isCurrentMonth: false,
      isToday: false,
      dateKey: getDateKey(date),
    });
  }

  // Days of current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    const dateKey = getDateKey(date);
    days.push({
      date,
      dayOfMonth: day,
      isCurrentMonth: true,
      isToday: dateKey === todayKey,
      dateKey,
    });
  }

  // Days from next month to fill last week
  const remainingDays = 7 - (days.length % 7);
  if (remainingDays < 7) {
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date,
        dayOfMonth: i,
        isCurrentMonth: false,
        isToday: false,
        dateKey: getDateKey(date),
      });
    }
  }

  return days;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  video: "Video",
  photo: "Photo",
  text: "Note",
};

interface EntryWithProject {
  entry: Entry;
  project?: Project;
}

interface CalendarDayCellProps {
  day: CalendarDay;
  entriesForDay: EntryWithProject[];
  projectsById: Record<string, Project>;
  onPress: () => void;
}

function CalendarDayCell({
  day,
  entriesForDay,
  projectsById,
  onPress,
}: CalendarDayCellProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const hasEntries = entriesForDay.length > 0;

  // Get unique projects for color dots
  const uniqueProjects = useMemo(() => {
    const seen = new Set<string>();
    return entriesForDay
      .filter((ep) => {
        if (!ep.entry.projectId || seen.has(ep.entry.projectId)) return false;
        seen.add(ep.entry.projectId);
        return true;
      })
      .map((ep) => projectsById[ep.entry.projectId])
      .filter(Boolean);
  }, [entriesForDay, projectsById]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Animated.View
      className="flex-1 aspect-square p-0.5"
      style={{ transform: [{ scale: scaleAnim }] }}
    >
      <Pressable
        onPress={hasEntries ? onPress : undefined}
        onPressIn={hasEntries ? handlePressIn : undefined}
        onPressOut={hasEntries ? handlePressOut : undefined}
        className={`flex-1 rounded-lg items-center justify-center ${
          day.isToday
            ? "border-2 border-primary"
            : day.isCurrentMonth
              ? "bg-surface/50"
              : "bg-transparent"
        }`}
        accessibilityRole={hasEntries ? "button" : "text"}
        accessibilityLabel={`${day.date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}${hasEntries ? `, ${entriesForDay.length} entries` : ""}`}
        accessibilityHint={hasEntries ? "Double tap to view entries" : undefined}
      >
        <Text
          className={`text-sm font-medium ${
            day.isToday
              ? "text-primary"
              : day.isCurrentMonth
                ? "text-text-primary"
                : "text-text-secondary/40"
          }`}
        >
          {day.dayOfMonth}
        </Text>

        {/* Entry indicators - show dots for each unique project */}
        {hasEntries && (
          <View className="flex-row mt-1 gap-0.5 justify-center flex-wrap max-w-full">
            {uniqueProjects.slice(0, 3).map((project, index) => {
              const gradientColors = project
                ? CATEGORY_GRADIENTS[project.category] || CATEGORY_GRADIENTS.custom
                : CATEGORY_GRADIENTS.custom;
              return (
                <View key={project?.id || index} className="overflow-hidden rounded-full">
                  <LinearGradient
                    colors={gradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ width: 6, height: 6 }}
                  />
                </View>
              );
            })}
            {uniqueProjects.length > 3 && (
              <Text className="text-xs text-text-secondary ml-0.5">
                +{uniqueProjects.length - 3}
              </Text>
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

interface DayEntriesModalProps {
  visible: boolean;
  date: Date;
  entriesWithProjects: EntryWithProject[];
  onClose: () => void;
  onEntryPress: (entryId: string) => void;
}

function DayEntriesModal({
  visible,
  date,
  entriesWithProjects,
  onClose,
  onEntryPress,
}: DayEntriesModalProps) {
  // Group entries by project
  const entriesByProject = useMemo(() => {
    const grouped: Record<string, EntryWithProject[]> = {};
    entriesWithProjects.forEach((ep) => {
      const projectId = ep.entry.projectId || "unknown";
      if (!grouped[projectId]) {
        grouped[projectId] = [];
      }
      grouped[projectId].push(ep);
    });
    return grouped;
  }, [entriesWithProjects]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/60 justify-end"
        onPress={onClose}
      >
        <Pressable
          className="bg-background rounded-t-3xl max-h-[70%]"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="px-4 py-4 border-b border-border">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text
                  className="text-text-primary text-lg font-semibold"
                  accessibilityRole="header"
                >
                  {formatDayHeader(date)}
                </Text>
                <Text className="text-text-secondary text-sm mt-1">
                  {entriesWithProjects.length} {entriesWithProjects.length === 1 ? "entry" : "entries"}
                </Text>
              </View>
              <IconButton
                icon="✕"
                variant="default"
                size="sm"
                onPress={onClose}
                accessibilityLabel="Close"
              />
            </View>
          </View>

          {/* Entries list grouped by project */}
          <ScrollView
            className="px-4 py-3"
            showsVerticalScrollIndicator={false}
          >
            {Object.entries(entriesByProject).map(([projectId, entries], groupIndex) => {
              const project = entries[0]?.project;
              const gradientColors = project
                ? CATEGORY_GRADIENTS[project.category] || CATEGORY_GRADIENTS.custom
                : CATEGORY_GRADIENTS.custom;

              return (
                <View key={projectId} className={groupIndex > 0 ? "mt-4" : ""}>
                  {/* Project header */}
                  <View className="flex-row items-center mb-2">
                    <View className="overflow-hidden rounded-full mr-2">
                      <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ width: 12, height: 12 }}
                      />
                    </View>
                    <Text className="text-text-primary font-semibold">
                      {project?.name || "Unknown Project"}
                    </Text>
                    <Text className="text-text-secondary text-sm ml-2">
                      ({entries.length})
                    </Text>
                  </View>

                  {/* Entries for this project */}
                  {entries.map((ep, index) => (
                    <Pressable
                      key={ep.entry.id}
                      onPress={() => onEntryPress(ep.entry.id)}
                      className="flex-row items-center py-3 active:bg-surface/50"
                      style={index < entries.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : undefined}
                    >
                      <EntryThumbnail entry={ep.entry} size="small" showDate={false} />
                      <View className="flex-1 ml-3">
                        <Text className="text-text-primary font-medium">
                          {ENTRY_TYPE_LABELS[ep.entry.entryType] || "Entry"}
                        </Text>
                        {ep.entry.contentText && ep.entry.entryType === "text" && (
                          <Text
                            className="text-text-secondary text-sm mt-0.5"
                            numberOfLines={1}
                          >
                            {ep.entry.contentText}
                          </Text>
                        )}
                        <Text className="text-text-secondary text-sm mt-1">
                          {formatTime(ep.entry.createdAt)}
                        </Text>
                      </View>
                      <Text className="text-text-secondary text-lg ml-2">›</Text>
                    </Pressable>
                  ))}
                </View>
              );
            })}
            <View className="h-6" />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function CrossProjectCalendarView({
  entries,
  projects,
  onEntryPress,
}: CrossProjectCalendarViewProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Create projects by ID map
  const projectsById = useMemo(() => {
    return projects.reduce(
      (acc, project) => {
        acc[project.id] = project;
        return acc;
      },
      {} as Record<string, Project>
    );
  }, [projects]);

  // Group entries by date key with project info
  const entriesByDate = useMemo(() => {
    const grouped: Record<string, EntryWithProject[]> = {};
    entries.forEach((entry) => {
      const date = new Date(entry.createdAt);
      const dateKey = getDateKey(date);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push({
        entry,
        project: projectsById[entry.projectId],
      });
    });
    return grouped;
  }, [entries, projectsById]);

  // Generate calendar days for current month
  const calendarDays = useMemo(
    () => generateCalendarDays(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );

  // Group days into weeks for rendering
  const weeks = useMemo(() => {
    const result: CalendarDay[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  const handlePreviousMonth = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const handleDayPress = useCallback((day: CalendarDay) => {
    setSelectedDay(day);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedDay(null);
  }, []);

  const handleEntryPress = useCallback(
    (entryId: string) => {
      handleCloseModal();
      if (onEntryPress) {
        onEntryPress(entryId);
      } else {
        router.push(`/entry/view/${entryId}` as Href);
      }
    },
    [router, onEntryPress, handleCloseModal]
  );

  const selectedDayEntries = useMemo(
    () => (selectedDay ? entriesByDate[selectedDay.dateKey] || [] : []),
    [selectedDay, entriesByDate]
  );

  // Count entries in current month
  const entriesThisMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return entries.filter((entry) => {
      const date = new Date(entry.createdAt);
      return date.getFullYear() === year && date.getMonth() === month;
    }).length;
  }, [entries, currentDate]);

  return (
    <View className="flex-1">
      {/* Month navigation header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <IconButton
          icon="‹"
          variant="default"
          size="md"
          onPress={handlePreviousMonth}
          accessibilityLabel="Previous month"
        />
        <Text
          className="text-text-primary text-lg font-semibold"
          accessibilityRole="header"
        >
          {formatMonthYear(currentDate)}
        </Text>
        <IconButton
          icon="›"
          variant="default"
          size="md"
          onPress={handleNextMonth}
          accessibilityLabel="Next month"
        />
      </View>

      {/* Weekday headers */}
      <View className="flex-row px-2 pb-2">
        {WEEKDAYS.map((day) => (
          <View key={day} className="flex-1 items-center">
            <Text className="text-text-secondary text-xs font-medium">
              {day}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View className="px-2">
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} className="flex-row">
            {week.map((day) => (
              <CalendarDayCell
                key={day.dateKey}
                day={day}
                entriesForDay={entriesByDate[day.dateKey] || []}
                projectsById={projectsById}
                onPress={() => handleDayPress(day)}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Entry count summary */}
      <View className="px-4 py-3 mt-2">
        <Text className="text-text-secondary text-sm text-center">
          {entriesThisMonth} {entriesThisMonth === 1 ? "entry" : "entries"} this month
        </Text>
      </View>

      {/* Day entries modal */}
      {selectedDay && (
        <DayEntriesModal
          visible={modalVisible}
          date={selectedDay.date}
          entriesWithProjects={selectedDayEntries}
          onClose={handleCloseModal}
          onEntryPress={handleEntryPress}
        />
      )}
    </View>
  );
}
