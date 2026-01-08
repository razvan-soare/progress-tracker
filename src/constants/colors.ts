export const colors = {
  background: "#0a0a0a",
  surface: "#1a1a1a",
  primary: "#6366f1",
  success: "#22c55e",
  error: "#ef4444",
  warning: "#f59e0b",
  textPrimary: "#ffffff",
  textSecondary: "#a1a1aa",
  border: "#2a2a2a",
} as const;

export type ColorName = keyof typeof colors;
