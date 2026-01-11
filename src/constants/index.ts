export * from "./colors";
export * from "./media";

export const APP_NAME = "Progress Tracker";
export const DATABASE_NAME = "progress-tracker.db";
export const DATABASE_VERSION = 1;

export const PROJECT_CATEGORIES = [
  { id: "fitness", label: "Fitness", icon: "💪" },
  { id: "learning", label: "Learning", icon: "📚" },
  { id: "creative", label: "Creative", icon: "🎨" },
  { id: "custom", label: "Custom", icon: "✨" },
] as const;

export const DAYS_OF_WEEK = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
] as const;
