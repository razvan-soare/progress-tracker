import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Toast, ToastType } from "@/components/ui/Toast";

interface ToastState {
  message: string;
  type: ToastType;
  visible: boolean;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface ToastContextType {
  showToast: (
    message: string,
    type?: ToastType,
    action?: { label: string; onPress: () => void }
  ) => void;
  showSuccess: (message: string) => void;
  showError: (message: string, onRetry?: () => void) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>({
    message: "",
    type: "info",
    visible: false,
  });

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = "info",
      action?: { label: string; onPress: () => void }
    ) => {
      setToast({ message, type, visible: true, action });
    },
    []
  );

  const showSuccess = useCallback((message: string) => {
    showToast(message, "success");
  }, [showToast]);

  const showError = useCallback(
    (message: string, onRetry?: () => void) => {
      showToast(
        message,
        "error",
        onRetry ? { label: "Retry", onPress: onRetry } : undefined
      );
    },
    [showToast]
  );

  const showWarning = useCallback((message: string) => {
    showToast(message, "warning");
  }, [showToast]);

  const showInfo = useCallback((message: string) => {
    showToast(message, "info");
  }, [showToast]);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  return (
    <ToastContext.Provider
      value={{ showToast, showSuccess, showError, showWarning, showInfo, hideToast }}
    >
      {children}
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onDismiss={hideToast}
        action={toast.action}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
