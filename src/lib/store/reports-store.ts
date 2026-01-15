import { create } from "zustand";
import type { Report, ReportRow } from "@/types";
import { getDatabase } from "@/lib/db/database";
import { reportRowToModel, reportModelToRow } from "@/lib/db/mappers";
import { generateId, formatDateTime } from "@/lib/utils";

export interface CreateReportInput {
  projectId: string;
  month: string;
  summaryText?: string;
  entryIds?: string[];
  firstEntryId?: string;
  lastEntryId?: string;
  totalEntries: number;
  totalVideos: number;
  totalPhotos: number;
  totalTextEntries: number;
  totalDurationSeconds: number;
}

export interface UpdateReportInput {
  summaryText?: string;
  entryIds?: string[];
  firstEntryId?: string;
  lastEntryId?: string;
  totalEntries?: number;
  totalVideos?: number;
  totalPhotos?: number;
  totalTextEntries?: number;
  totalDurationSeconds?: number;
}

interface ReportsState {
  reports: Report[];
  reportsByProject: Record<string, Report[]>;
  reportsById: Record<string, Report>;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchReportsByProjectId: (projectId: string) => Promise<Report[]>;
  fetchReportById: (id: string) => Promise<Report | null>;
  getReportByMonth: (projectId: string, month: string) => Promise<Report | null>;
  createReport: (input: CreateReportInput) => Promise<Report>;
  updateReport: (id: string, input: UpdateReportInput) => Promise<Report>;
  deleteReport: (id: string) => Promise<void>;
  clearProjectReports: (projectId: string) => void;
  clearError: () => void;
}

export const useReportsStore = create<ReportsState>((set, get) => ({
  reports: [],
  reportsByProject: {},
  reportsById: {},
  isLoading: false,
  error: null,

  fetchReportsByProjectId: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<ReportRow>(
        "SELECT * FROM reports WHERE project_id = ? ORDER BY month DESC",
        [projectId]
      );
      const reports = rows.map(reportRowToModel);

      const reportsById = reports.reduce(
        (acc, report) => {
          acc[report.id] = report;
          return acc;
        },
        {} as Record<string, Report>
      );

      set((state) => ({
        reports,
        reportsByProject: {
          ...state.reportsByProject,
          [projectId]: reports,
        },
        reportsById: { ...state.reportsById, ...reportsById },
        isLoading: false,
      }));

      return reports;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to fetch reports",
        isLoading: false,
      });
      return [];
    }
  },

  fetchReportById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<ReportRow>(
        "SELECT * FROM reports WHERE id = ?",
        [id]
      );

      if (!row) {
        set({ isLoading: false });
        return null;
      }

      const report = reportRowToModel(row);
      set((state) => ({
        reportsById: { ...state.reportsById, [id]: report },
        isLoading: false,
      }));
      return report;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to fetch report",
        isLoading: false,
      });
      return null;
    }
  },

  getReportByMonth: async (projectId: string, month: string) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<ReportRow>(
        "SELECT * FROM reports WHERE project_id = ? AND month = ?",
        [projectId, month]
      );

      if (!row) {
        set({ isLoading: false });
        return null;
      }

      const report = reportRowToModel(row);
      set((state) => ({
        reportsById: { ...state.reportsById, [report.id]: report },
        isLoading: false,
      }));
      return report;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to fetch report by month",
        isLoading: false,
      });
      return null;
    }
  },

  createReport: async (input: CreateReportInput) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();

      // Check for existing report for the same project and month
      const existingRow = await db.getFirstAsync<ReportRow>(
        "SELECT * FROM reports WHERE project_id = ? AND month = ?",
        [input.projectId, input.month]
      );

      if (existingRow) {
        set({ isLoading: false });
        throw new Error(`Report for ${input.month} already exists for this project`);
      }

      const now = formatDateTime(new Date());
      const report: Report = {
        id: generateId(),
        projectId: input.projectId,
        month: input.month,
        summaryText: input.summaryText,
        entryIds: input.entryIds,
        firstEntryId: input.firstEntryId,
        lastEntryId: input.lastEntryId,
        totalEntries: input.totalEntries,
        totalVideos: input.totalVideos,
        totalPhotos: input.totalPhotos,
        totalTextEntries: input.totalTextEntries,
        totalDurationSeconds: input.totalDurationSeconds,
        generatedAt: now,
      };

      const row = reportModelToRow(report);
      await db.runAsync(
        `INSERT INTO reports (
          id, project_id, month, summary_text, entry_ids,
          first_entry_id, last_entry_id, total_entries,
          total_videos, total_photos, total_text_entries,
          total_duration_seconds, generated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.project_id,
          row.month,
          row.summary_text,
          row.entry_ids,
          row.first_entry_id,
          row.last_entry_id,
          row.total_entries,
          row.total_videos,
          row.total_photos,
          row.total_text_entries,
          row.total_duration_seconds,
          row.generated_at,
        ]
      );

      set((state) => {
        const projectReports = state.reportsByProject[input.projectId] ?? [];
        // Insert in correct position (sorted by month desc)
        const updatedProjectReports = [...projectReports, report].sort(
          (a, b) => b.month.localeCompare(a.month)
        );

        return {
          reports: [report, ...state.reports],
          reportsByProject: {
            ...state.reportsByProject,
            [input.projectId]: updatedProjectReports,
          },
          reportsById: { ...state.reportsById, [report.id]: report },
          isLoading: false,
        };
      });

      return report;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create report";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  updateReport: async (id: string, input: UpdateReportInput) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();

      // Get existing report
      let existingReport = get().reportsById[id];
      if (!existingReport) {
        const fetched = await get().fetchReportById(id);
        if (!fetched) {
          throw new Error("Report not found");
        }
        existingReport = fetched;
      }

      const now = formatDateTime(new Date());
      const updatedReport: Report = {
        ...existingReport,
        summaryText: input.summaryText !== undefined ? input.summaryText : existingReport.summaryText,
        entryIds: input.entryIds !== undefined ? input.entryIds : existingReport.entryIds,
        firstEntryId: input.firstEntryId !== undefined ? input.firstEntryId : existingReport.firstEntryId,
        lastEntryId: input.lastEntryId !== undefined ? input.lastEntryId : existingReport.lastEntryId,
        totalEntries: input.totalEntries !== undefined ? input.totalEntries : existingReport.totalEntries,
        totalVideos: input.totalVideos !== undefined ? input.totalVideos : existingReport.totalVideos,
        totalPhotos: input.totalPhotos !== undefined ? input.totalPhotos : existingReport.totalPhotos,
        totalTextEntries: input.totalTextEntries !== undefined ? input.totalTextEntries : existingReport.totalTextEntries,
        totalDurationSeconds: input.totalDurationSeconds !== undefined ? input.totalDurationSeconds : existingReport.totalDurationSeconds,
        generatedAt: now,
      };

      const row = reportModelToRow(updatedReport);
      await db.runAsync(
        `UPDATE reports SET
          summary_text = ?, entry_ids = ?, first_entry_id = ?,
          last_entry_id = ?, total_entries = ?, total_videos = ?,
          total_photos = ?, total_text_entries = ?,
          total_duration_seconds = ?, generated_at = ?
        WHERE id = ?`,
        [
          row.summary_text,
          row.entry_ids,
          row.first_entry_id,
          row.last_entry_id,
          row.total_entries,
          row.total_videos,
          row.total_photos,
          row.total_text_entries,
          row.total_duration_seconds,
          row.generated_at,
          id,
        ]
      );

      set((state) => {
        const projectReports = state.reportsByProject[updatedReport.projectId] ?? [];
        return {
          reports: state.reports.map((r) => (r.id === id ? updatedReport : r)),
          reportsByProject: {
            ...state.reportsByProject,
            [updatedReport.projectId]: projectReports.map((r) =>
              r.id === id ? updatedReport : r
            ),
          },
          reportsById: { ...state.reportsById, [id]: updatedReport },
          isLoading: false,
        };
      });

      return updatedReport;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to update report",
        isLoading: false,
      });
      throw error;
    }
  },

  deleteReport: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const report = get().reportsById[id];

      // Hard delete the report
      await db.runAsync("DELETE FROM reports WHERE id = ?", [id]);

      set((state) => {
        const newReportsById = { ...state.reportsById };
        delete newReportsById[id];

        const newReportsByProject = { ...state.reportsByProject };
        if (report && newReportsByProject[report.projectId]) {
          newReportsByProject[report.projectId] = newReportsByProject[
            report.projectId
          ].filter((r) => r.id !== id);
        }

        return {
          reports: state.reports.filter((r) => r.id !== id),
          reportsByProject: newReportsByProject,
          reportsById: newReportsById,
          isLoading: false,
        };
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to delete report",
        isLoading: false,
      });
      throw error;
    }
  },

  clearProjectReports: (projectId: string) => {
    set((state) => {
      const newReportsByProject = { ...state.reportsByProject };
      delete newReportsByProject[projectId];

      return {
        reportsByProject: newReportsByProject,
      };
    });
  },

  clearError: () => set({ error: null }),
}));
