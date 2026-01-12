import { useState, useCallback } from "react";
import type { SyncConflict, ConflictResolution, Entry } from "@/types";
import {
  applyConflictResolution,
  autoResolveConflicts,
  checkEntriesForConflicts,
} from "./conflict-detection-service";

export interface ConflictResolutionState {
  pendingConflicts: SyncConflict[];
  currentConflict: SyncConflict | null;
  resolvedConflicts: SyncConflict[];
  isProcessing: boolean;
}

export interface UseConflictResolutionReturn {
  state: ConflictResolutionState;
  showModal: boolean;
  checkForConflicts: (
    localEntries: Entry[],
    remoteEntries: Map<string, Entry>,
    deletedRemoteIds: Set<string>
  ) => Promise<SyncConflict[]>;
  resolveConflict: (resolution: ConflictResolution) => Promise<Entry>;
  resolveAllAutomatically: () => Promise<{
    resolved: SyncConflict[];
    needsUserInput: SyncConflict[];
  }>;
  skipCurrentConflict: () => void;
  cancelResolution: () => void;
  clearResolved: () => void;
}

export function useConflictResolution(): UseConflictResolutionReturn {
  const [state, setState] = useState<ConflictResolutionState>({
    pendingConflicts: [],
    currentConflict: null,
    resolvedConflicts: [],
    isProcessing: false,
  });

  const showModal = state.currentConflict !== null;

  const checkForConflicts = useCallback(
    async (
      localEntries: Entry[],
      remoteEntries: Map<string, Entry>,
      deletedRemoteIds: Set<string>
    ): Promise<SyncConflict[]> => {
      setState((prev) => ({ ...prev, isProcessing: true }));

      try {
        const conflicts = await checkEntriesForConflicts(
          localEntries,
          remoteEntries,
          deletedRemoteIds
        );

        // Auto-resolve what we can
        const { resolved, needsUserInput } = await autoResolveConflicts(conflicts);

        setState((prev) => ({
          ...prev,
          pendingConflicts: needsUserInput,
          currentConflict: needsUserInput[0] ?? null,
          resolvedConflicts: [...prev.resolvedConflicts, ...resolved],
          isProcessing: false,
        }));

        return needsUserInput;
      } catch (error) {
        setState((prev) => ({ ...prev, isProcessing: false }));
        throw error;
      }
    },
    []
  );

  const resolveConflict = useCallback(
    async (resolution: ConflictResolution): Promise<Entry> => {
      const { currentConflict, pendingConflicts } = state;

      if (!currentConflict) {
        throw new Error("No conflict to resolve");
      }

      setState((prev) => ({ ...prev, isProcessing: true }));

      try {
        const resolvedEntry = await applyConflictResolution(
          currentConflict,
          resolution
        );

        // Move to next conflict
        const remainingConflicts = pendingConflicts.filter(
          (c) => c.id !== currentConflict.id
        );
        const nextConflict = remainingConflicts[0] ?? null;

        setState((prev) => ({
          ...prev,
          pendingConflicts: remainingConflicts,
          currentConflict: nextConflict,
          resolvedConflicts: [...prev.resolvedConflicts, currentConflict],
          isProcessing: false,
        }));

        return resolvedEntry;
      } catch (error) {
        setState((prev) => ({ ...prev, isProcessing: false }));
        throw error;
      }
    },
    [state]
  );

  const resolveAllAutomatically = useCallback(async (): Promise<{
    resolved: SyncConflict[];
    needsUserInput: SyncConflict[];
  }> => {
    setState((prev) => ({ ...prev, isProcessing: true }));

    try {
      const { resolved, needsUserInput } = await autoResolveConflicts(
        state.pendingConflicts
      );

      setState((prev) => ({
        ...prev,
        pendingConflicts: needsUserInput,
        currentConflict: needsUserInput[0] ?? null,
        resolvedConflicts: [...prev.resolvedConflicts, ...resolved],
        isProcessing: false,
      }));

      return { resolved, needsUserInput };
    } catch (error) {
      setState((prev) => ({ ...prev, isProcessing: false }));
      throw error;
    }
  }, [state.pendingConflicts]);

  const skipCurrentConflict = useCallback(() => {
    setState((prev) => {
      const { currentConflict, pendingConflicts } = prev;
      if (!currentConflict) return prev;

      // Move current to end of pending list
      const remainingConflicts = pendingConflicts.filter(
        (c) => c.id !== currentConflict.id
      );
      const reorderedConflicts = [...remainingConflicts, currentConflict];
      const nextConflict = remainingConflicts[0] ?? null;

      return {
        ...prev,
        pendingConflicts: reorderedConflicts,
        currentConflict: nextConflict,
      };
    });
  }, []);

  const cancelResolution = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentConflict: null,
    }));
  }, []);

  const clearResolved = useCallback(() => {
    setState((prev) => ({
      ...prev,
      resolvedConflicts: [],
    }));
  }, []);

  return {
    state,
    showModal,
    checkForConflicts,
    resolveConflict,
    resolveAllAutomatically,
    skipCurrentConflict,
    cancelResolution,
    clearResolved,
  };
}
