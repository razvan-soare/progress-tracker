import React, { Component, ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { colors } from "@/constants/colors";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View
          className="flex-1 items-center justify-center px-6 bg-background"
          accessibilityRole="alert"
          accessibilityLabel="An error occurred"
        >
          <Text className="text-5xl mb-4">😵</Text>
          <Text className="text-text-primary text-xl font-semibold text-center mb-2">
            Something went wrong
          </Text>
          <Text className="text-text-secondary text-center mb-6">
            {this.state.error?.message || "An unexpected error occurred"}
          </Text>
          <Pressable
            onPress={this.handleRetry}
            className="bg-primary px-6 py-3 rounded-lg active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}
