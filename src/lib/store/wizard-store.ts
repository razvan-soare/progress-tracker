import { create } from "zustand";
import type { ProjectCategory } from "@/types";
import { formatDate } from "@/lib/utils";

export interface WizardFormData {
  // Step 1: Basic Info
  name: string;
  description: string;
  startDate: string;
  // Step 2: Category & Reminders
  category: ProjectCategory | null;
  reminderEnabled: boolean;
  reminderTime: string;
  reminderDays: string[];
}

export interface WizardFormErrors {
  name?: string;
  description?: string;
  startDate?: string;
  category?: string;
}

interface WizardState {
  currentStep: number;
  formData: WizardFormData;
  errors: WizardFormErrors;
  isDirty: boolean;

  // Actions
  setFormField: <K extends keyof WizardFormData>(
    field: K,
    value: WizardFormData[K]
  ) => void;
  setError: (field: keyof WizardFormErrors, error: string | undefined) => void;
  clearErrors: () => void;
  validateBasicInfo: () => boolean;
  validateCategory: () => boolean;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;
  resetWizard: () => void;
  hasFormData: () => boolean;
}

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_REMINDER_TIME = "20:00";

const getInitialFormData = (): WizardFormData => ({
  name: "",
  description: "",
  startDate: formatDate(new Date()),
  category: null,
  reminderEnabled: false,
  reminderTime: DEFAULT_REMINDER_TIME,
  reminderDays: [...ALL_DAYS],
});

export const useWizardStore = create<WizardState>((set, get) => ({
  currentStep: 1,
  formData: getInitialFormData(),
  errors: {},
  isDirty: false,

  setFormField: (field, value) => {
    set((state) => ({
      formData: { ...state.formData, [field]: value },
      isDirty: true,
      // Clear error for this field when user types
      errors: { ...state.errors, [field]: undefined },
    }));
  },

  setError: (field, error) => {
    set((state) => ({
      errors: { ...state.errors, [field]: error },
    }));
  },

  clearErrors: () => {
    set({ errors: {} });
  },

  validateBasicInfo: () => {
    const { formData } = get();
    const errors: WizardFormErrors = {};
    let isValid = true;

    // Validate name
    if (!formData.name.trim()) {
      errors.name = "Project name is required";
      isValid = false;
    } else if (formData.name.trim().length > 50) {
      errors.name = "Project name must be 50 characters or less";
      isValid = false;
    }

    // Validate description
    if (formData.description.length > 200) {
      errors.description = "Description must be 200 characters or less";
      isValid = false;
    }

    // Validate start date
    if (!formData.startDate) {
      errors.startDate = "Start date is required";
      isValid = false;
    } else {
      const startDate = new Date(formData.startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);

      if (startDate > today) {
        errors.startDate = "Start date cannot be in the future";
        isValid = false;
      }
    }

    set({ errors });
    return isValid;
  },

  validateCategory: () => {
    const { formData } = get();
    const errors: WizardFormErrors = {};
    let isValid = true;

    if (!formData.category) {
      errors.category = "Please select a category";
      isValid = false;
    }

    set((state) => ({ errors: { ...state.errors, ...errors } }));
    return isValid;
  },

  nextStep: () => {
    set((state) => ({ currentStep: Math.min(state.currentStep + 1, 3) }));
  },

  previousStep: () => {
    set((state) => ({ currentStep: Math.max(state.currentStep - 1, 1) }));
  },

  goToStep: (step) => {
    if (step >= 1 && step <= 3) {
      set({ currentStep: step });
    }
  },

  resetWizard: () => {
    set({
      currentStep: 1,
      formData: getInitialFormData(),
      errors: {},
      isDirty: false,
    });
  },

  hasFormData: () => {
    const { formData } = get();
    return !!(
      formData.name.trim() ||
      formData.description.trim() ||
      formData.category
    );
  },
}));
