import { useCallback, useEffect, useMemo } from "react";
import { useProjectsStore, ProjectStats } from "./projects-store";
import { useEntriesStore, EntryFilter, SortOrder, CreateEntryInput } from "./entries-store";
import { getAlertsScheduler } from "@/lib/notifications/alerts-scheduler";
import type { Project, Entry, EntryType } from "@/types";

/**
 * Hook for accessing all projects.
 * Fetches projects on mount and provides list, loading, and error states.
 */
export function useProjects() {
  const projects = useProjectsStore((state) => state.projects);
  const isLoading = useProjectsStore((state) => state.isLoading);
  const error = useProjectsStore((state) => state.error);
  const fetchProjects = useProjectsStore((state) => state.fetchProjects);
  const clearError = useProjectsStore((state) => state.clearError);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const refetch = useCallback(() => {
    return fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    isLoading,
    error,
    refetch,
    clearError,
  };
}

/**
 * Hook for accessing a single project by ID with statistics.
 * Provides project data, stats, loading, and error states.
 */
export function useProject(projectId: string | null | undefined) {
  const projectsById = useProjectsStore((state) => state.projectsById);
  const projectStats = useProjectsStore((state) => state.projectStats);
  const isLoading = useProjectsStore((state) => state.isLoading);
  const error = useProjectsStore((state) => state.error);
  const fetchProjectById = useProjectsStore((state) => state.fetchProjectById);
  const fetchProjectStats = useProjectsStore((state) => state.fetchProjectStats);
  const clearError = useProjectsStore((state) => state.clearError);

  const project = projectId ? projectsById[projectId] : null;
  const stats = projectId ? projectStats[projectId] : null;

  useEffect(() => {
    if (projectId) {
      fetchProjectById(projectId);
      fetchProjectStats(projectId);
    }
  }, [projectId, fetchProjectById, fetchProjectStats]);

  const refetch = useCallback(() => {
    if (!projectId) return Promise.resolve(null);
    return Promise.all([
      fetchProjectById(projectId),
      fetchProjectStats(projectId),
    ]).then(([proj]) => proj);
  }, [projectId, fetchProjectById, fetchProjectStats]);

  const refetchStats = useCallback(() => {
    if (!projectId) return Promise.resolve(null);
    return fetchProjectStats(projectId);
  }, [projectId, fetchProjectStats]);

  return {
    project,
    stats,
    isLoading,
    error,
    refetch,
    refetchStats,
    clearError,
  };
}

export interface UseEntriesOptions {
  entryTypes?: EntryType[];
  startDate?: string;
  endDate?: string;
  sortOrder?: SortOrder;
}

/**
 * Hook for accessing entries for a project with filtering and sorting.
 * Supports filtering by entry type and date range, with customizable sort order.
 */
export function useEntries(
  projectId: string | null | undefined,
  options: UseEntriesOptions = {}
) {
  const entriesByProject = useEntriesStore((state) => state.entriesByProject);
  const isLoading = useEntriesStore((state) => state.isLoading);
  const error = useEntriesStore((state) => state.error);
  const fetchEntries = useEntriesStore((state) => state.fetchEntries);
  const clearError = useEntriesStore((state) => state.clearError);

  const { entryTypes, startDate, endDate, sortOrder = "desc" } = options;

  // Memoize filter to avoid unnecessary re-fetches
  const filter: EntryFilter | null = useMemo(() => {
    if (!projectId) return null;
    return {
      projectId,
      entryTypes,
      startDate,
      endDate,
    };
  }, [projectId, entryTypes, startDate, endDate]);

  useEffect(() => {
    if (filter) {
      fetchEntries(filter, sortOrder);
    }
  }, [filter, sortOrder, fetchEntries]);

  const entries = projectId ? entriesByProject[projectId] ?? [] : [];

  const refetch = useCallback(() => {
    if (!filter) return Promise.resolve([]);
    return fetchEntries(filter, sortOrder);
  }, [filter, sortOrder, fetchEntries]);

  // Computed statistics for the current filter
  const statistics = useMemo(() => {
    return {
      totalCount: entries.length,
      videoCount: entries.filter((e) => e.entryType === "video").length,
      photoCount: entries.filter((e) => e.entryType === "photo").length,
      textCount: entries.filter((e) => e.entryType === "text").length,
    };
  }, [entries]);

  return {
    entries,
    statistics,
    isLoading,
    error,
    refetch,
    clearError,
  };
}

/**
 * Hook for accessing all entries across all projects.
 * Provides entries list, loading, and error states.
 */
export function useAllEntries(options: UseEntriesOptions = {}) {
  const allEntries = useEntriesStore((state) => state.allEntries);
  const isLoading = useEntriesStore((state) => state.isLoading);
  const error = useEntriesStore((state) => state.error);
  const fetchAllEntries = useEntriesStore((state) => state.fetchAllEntries);
  const clearError = useEntriesStore((state) => state.clearError);

  const { sortOrder = "desc" } = options;

  useEffect(() => {
    fetchAllEntries(sortOrder);
  }, [sortOrder, fetchAllEntries]);

  const refetch = useCallback(() => {
    return fetchAllEntries(sortOrder);
  }, [sortOrder, fetchAllEntries]);

  // Computed statistics for all entries
  const statistics = useMemo(() => {
    return {
      totalCount: allEntries.length,
      videoCount: allEntries.filter((e) => e.entryType === "video").length,
      photoCount: allEntries.filter((e) => e.entryType === "photo").length,
      textCount: allEntries.filter((e) => e.entryType === "text").length,
    };
  }, [allEntries]);

  return {
    entries: allEntries,
    statistics,
    isLoading,
    error,
    refetch,
    clearError,
  };
}

/**
 * Hook for accessing a single entry by ID.
 * Provides entry data, loading, and error states.
 */
export function useEntry(entryId: string | null | undefined) {
  const entriesById = useEntriesStore((state) => state.entriesById);
  const isLoading = useEntriesStore((state) => state.isLoading);
  const error = useEntriesStore((state) => state.error);
  const fetchEntryById = useEntriesStore((state) => state.fetchEntryById);
  const clearError = useEntriesStore((state) => state.clearError);

  const entry = entryId ? entriesById[entryId] : null;

  useEffect(() => {
    if (entryId && !entriesById[entryId]) {
      fetchEntryById(entryId);
    }
  }, [entryId, entriesById, fetchEntryById]);

  const refetch = useCallback(() => {
    if (!entryId) return Promise.resolve(null);
    return fetchEntryById(entryId);
  }, [entryId, fetchEntryById]);

  return {
    entry,
    isLoading,
    error,
    refetch,
    clearError,
  };
}

/**
 * Hook for project CRUD operations.
 * Returns mutation functions for creating, updating, and deleting projects.
 */
export function useProjectMutations() {
  const createProject = useProjectsStore((state) => state.createProject);
  const updateProject = useProjectsStore((state) => state.updateProject);
  const deleteProject = useProjectsStore((state) => state.deleteProject);
  const isLoading = useProjectsStore((state) => state.isLoading);
  const error = useProjectsStore((state) => state.error);
  const clearError = useProjectsStore((state) => state.clearError);

  return {
    createProject,
    updateProject,
    deleteProject,
    isLoading,
    error,
    clearError,
  };
}

/**
 * Hook for entry CRUD operations.
 * Returns mutation functions for creating, updating, deleting, and restoring entries.
 */
export function useEntryMutations() {
  const createEntryBase = useEntriesStore((state) => state.createEntry);
  const updateEntry = useEntriesStore((state) => state.updateEntry);
  const deleteEntry = useEntriesStore((state) => state.deleteEntry);
  const restoreEntry = useEntriesStore((state) => state.restoreEntry);
  const isLoading = useEntriesStore((state) => state.isLoading);
  const error = useEntriesStore((state) => state.error);
  const clearError = useEntriesStore((state) => state.clearError);

  // Wrapper that clears streak alerts when a new entry is created
  const createEntry = useCallback(
    async (input: CreateEntryInput) => {
      const entry = await createEntryBase(input);
      // Clear streak alert for this project since user just added an entry
      try {
        getAlertsScheduler().clearStreakAlertForProject(input.projectId);
      } catch {
        // Ignore errors - alert clearing is not critical
      }
      return entry;
    },
    [createEntryBase]
  );

  return {
    createEntry,
    updateEntry,
    deleteEntry,
    restoreEntry,
    isLoading,
    error,
    clearError,
  };
}
