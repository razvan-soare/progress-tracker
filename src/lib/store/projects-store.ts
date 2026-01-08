import { create } from "zustand";
import type { Project, ProjectRow, ProjectCategory } from "@/types";
import { getDatabase } from "@/lib/db/database";
import { projectRowToModel, projectModelToRow } from "@/lib/db/mappers";
import { generateId, formatDateTime } from "@/lib/utils";

export interface ProjectStats {
  totalEntries: number;
  streakCount: number;
  daysSinceStart: number;
  videoCount: number;
  photoCount: number;
  textCount: number;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  category: ProjectCategory;
  coverImageUri?: string;
  startDate?: string;
  endDate?: string;
  reminderTime?: string;
  reminderDays?: string[];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  category?: ProjectCategory;
  coverImageUri?: string;
  startDate?: string;
  endDate?: string;
  reminderTime?: string;
  reminderDays?: string[];
}

interface ProjectsState {
  projects: Project[];
  projectsById: Record<string, Project>;
  projectStats: Record<string, ProjectStats>;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchProjects: () => Promise<void>;
  fetchProjectById: (id: string) => Promise<Project | null>;
  fetchProjectStats: (id: string) => Promise<ProjectStats | null>;
  createProject: (input: CreateProjectInput) => Promise<Project>;
  updateProject: (id: string, input: UpdateProjectInput) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  projectsById: {},
  projectStats: {},
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<ProjectRow>(
        "SELECT * FROM projects WHERE is_deleted = 0 ORDER BY updated_at DESC"
      );
      const projects = rows.map(projectRowToModel);
      const projectsById = projects.reduce(
        (acc, project) => {
          acc[project.id] = project;
          return acc;
        },
        {} as Record<string, Project>
      );
      set({ projects, projectsById, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to fetch projects",
        isLoading: false,
      });
    }
  },

  fetchProjectById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<ProjectRow>(
        "SELECT * FROM projects WHERE id = ? AND is_deleted = 0",
        [id]
      );
      if (!row) {
        set({ isLoading: false });
        return null;
      }
      const project = projectRowToModel(row);
      set((state) => ({
        projectsById: { ...state.projectsById, [id]: project },
        isLoading: false,
      }));
      return project;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to fetch project",
        isLoading: false,
      });
      return null;
    }
  },

  fetchProjectStats: async (id: string) => {
    try {
      const db = await getDatabase();

      // Get project to calculate days since start
      const projectRow = await db.getFirstAsync<ProjectRow>(
        "SELECT * FROM projects WHERE id = ? AND is_deleted = 0",
        [id]
      );
      if (!projectRow) {
        return null;
      }

      // Get entry counts by type
      const countResult = await db.getFirstAsync<{
        total: number;
        videos: number;
        photos: number;
        texts: number;
      }>(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN entry_type = 'video' THEN 1 ELSE 0 END) as videos,
          SUM(CASE WHEN entry_type = 'photo' THEN 1 ELSE 0 END) as photos,
          SUM(CASE WHEN entry_type = 'text' THEN 1 ELSE 0 END) as texts
        FROM entries
        WHERE project_id = ? AND is_deleted = 0`,
        [id]
      );

      // Calculate streak - count consecutive days with entries from today backwards
      const streakResult = await db.getAllAsync<{ entry_date: string }>(
        `SELECT DISTINCT date(created_at) as entry_date
         FROM entries
         WHERE project_id = ? AND is_deleted = 0
         ORDER BY entry_date DESC`,
        [id]
      );

      let streakCount = 0;
      if (streakResult.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if there's an entry today or yesterday to start the streak
        const firstEntryDate = new Date(streakResult[0].entry_date);
        firstEntryDate.setHours(0, 0, 0, 0);

        const diffFromToday = Math.floor(
          (today.getTime() - firstEntryDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Only count streak if most recent entry is today or yesterday
        if (diffFromToday <= 1) {
          streakCount = 1;
          let previousDate = firstEntryDate;

          for (let i = 1; i < streakResult.length; i++) {
            const currentDate = new Date(streakResult[i].entry_date);
            currentDate.setHours(0, 0, 0, 0);

            const diffDays = Math.floor(
              (previousDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (diffDays === 1) {
              streakCount++;
              previousDate = currentDate;
            } else {
              break;
            }
          }
        }
      }

      // Calculate days since start
      const startDate = new Date(projectRow.start_date);
      startDate.setHours(0, 0, 0, 0);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const daysSinceStart = Math.floor(
        (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const stats: ProjectStats = {
        totalEntries: countResult?.total ?? 0,
        streakCount,
        daysSinceStart: Math.max(0, daysSinceStart),
        videoCount: countResult?.videos ?? 0,
        photoCount: countResult?.photos ?? 0,
        textCount: countResult?.texts ?? 0,
      };

      set((state) => ({
        projectStats: { ...state.projectStats, [id]: stats },
      }));

      return stats;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to fetch project stats",
      });
      return null;
    }
  },

  createProject: async (input: CreateProjectInput) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const now = formatDateTime(new Date());
      const project: Project = {
        id: generateId(),
        name: input.name,
        description: input.description,
        category: input.category,
        coverImageUri: input.coverImageUri,
        startDate: input.startDate ?? now.split("T")[0],
        endDate: input.endDate,
        reminderTime: input.reminderTime,
        reminderDays: input.reminderDays,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      };

      const row = projectModelToRow(project);
      await db.runAsync(
        `INSERT INTO projects (
          id, name, description, category, cover_image_uri, start_date, end_date,
          reminder_time, reminder_days, created_at, updated_at, synced_at, is_deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.name,
          row.description,
          row.category,
          row.cover_image_uri,
          row.start_date,
          row.end_date,
          row.reminder_time,
          row.reminder_days,
          row.created_at,
          row.updated_at,
          row.synced_at,
          row.is_deleted ?? 0,
        ]
      );

      set((state) => ({
        projects: [project, ...state.projects],
        projectsById: { ...state.projectsById, [project.id]: project },
        isLoading: false,
      }));

      return project;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to create project",
        isLoading: false,
      });
      throw error;
    }
  },

  updateProject: async (id: string, input: UpdateProjectInput) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const existingProject = get().projectsById[id];

      if (!existingProject) {
        const fetched = await get().fetchProjectById(id);
        if (!fetched) {
          throw new Error("Project not found");
        }
      }

      const currentProject = get().projectsById[id];
      const now = formatDateTime(new Date());
      const updatedProject: Project = {
        ...currentProject,
        name: input.name ?? currentProject.name,
        description: input.description !== undefined ? input.description : currentProject.description,
        category: input.category ?? currentProject.category,
        coverImageUri: input.coverImageUri !== undefined ? input.coverImageUri : currentProject.coverImageUri,
        startDate: input.startDate ?? currentProject.startDate,
        endDate: input.endDate !== undefined ? input.endDate : currentProject.endDate,
        reminderTime: input.reminderTime !== undefined ? input.reminderTime : currentProject.reminderTime,
        reminderDays: input.reminderDays !== undefined ? input.reminderDays : currentProject.reminderDays,
        updatedAt: now,
      };

      const row = projectModelToRow(updatedProject);
      await db.runAsync(
        `UPDATE projects SET
          name = ?, description = ?, category = ?, cover_image_uri = ?,
          start_date = ?, end_date = ?, reminder_time = ?, reminder_days = ?,
          updated_at = ?
        WHERE id = ?`,
        [
          row.name,
          row.description,
          row.category,
          row.cover_image_uri,
          row.start_date,
          row.end_date,
          row.reminder_time,
          row.reminder_days,
          row.updated_at,
          id,
        ]
      );

      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? updatedProject : p)),
        projectsById: { ...state.projectsById, [id]: updatedProject },
        isLoading: false,
      }));

      return updatedProject;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to update project",
        isLoading: false,
      });
      throw error;
    }
  },

  deleteProject: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const now = formatDateTime(new Date());

      // Soft delete the project
      await db.runAsync(
        "UPDATE projects SET is_deleted = 1, updated_at = ? WHERE id = ?",
        [now, id]
      );

      // Also soft delete all entries for this project
      await db.runAsync(
        "UPDATE entries SET is_deleted = 1 WHERE project_id = ?",
        [id]
      );

      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        projectsById: Object.fromEntries(
          Object.entries(state.projectsById).filter(([key]) => key !== id)
        ),
        projectStats: Object.fromEntries(
          Object.entries(state.projectStats).filter(([key]) => key !== id)
        ),
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to delete project",
        isLoading: false,
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
