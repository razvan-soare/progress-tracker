import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { colors } from "@/constants/colors";

interface CompressionOverlayProps {
  message?: string;
}

/**
 * Full-screen overlay shown during media compression
 * Displays a loading spinner with "Preparing media..." message
 */
export function CompressionOverlay({
  message = "Preparing media...",
}: CompressionOverlayProps) {
  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel={message}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  content: {
    alignItems: "center",
    padding: 24,
  },
  message: {
    color: "#ffffff",
    fontSize: 16,
    marginTop: 16,
    fontWeight: "500",
  },
});
