import type { Entry, EntryRow } from "@/types";
import { getDatabase } from "@/lib/db/database";
import { entryRowToModel } from "@/lib/db/mappers";
import { useReportsStore, type CreateReportInput } from "@/lib/store/reports-store";

/**
 * Result of a report generation operation
 */
export interface ReportGenerationResult {
  success: boolean;
  reportId?: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Statistics calculated for a month's entries
 */
interface MonthStatistics {
  totalEntries: number;
  totalVideos: number;
  totalPhotos: number;
  totalTextEntries: number;
  totalDurationSeconds: number;
  entryIds: string[];
  firstEntry: Entry | null;
  lastEntry: Entry | null;
}

/**
 * Get the start and end dates for a given month in YYYY-MM format
 */
function getMonthDateRange(month: string): { startDate: string; endDate: string } {
  const [year, monthNum] = month.split("-").map(Number);

  // First day of the month
  const startDate = `${year}-${String(monthNum).padStart(2, "0")}-01`;

  // Last day of the month
  const lastDay = new Date(year, monthNum, 0).getDate();
  const endDate = `${year}-${String(monthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return { startDate, endDate };
}

/**
 * Get the month name from a YYYY-MM format string
 */
function getMonthName(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  const date = new Date(year, monthNum - 1, 1);
  return date.toLocaleString("en-US", { month: "long" });
}

/**
 * Query all non-deleted entries for a project within a specified month
 */
async function getEntriesForMonth(
  projectId: string,
  month: string
): Promise<Entry[]> {
  const db = await getDatabase();
  const { startDate, endDate } = getMonthDateRange(month);

  const rows = await db.getAllAsync<EntryRow>(
    `SELECT * FROM entries
     WHERE project_id = ?
       AND is_deleted = 0
       AND date(created_at) >= ?
       AND date(created_at) <= ?
     ORDER BY created_at ASC`,
    [projectId, startDate, endDate]
  );

  return rows.map(entryRowToModel);
}

/**
 * Calculate statistics from a list of entries
 */
function calculateStatistics(entries: Entry[]): MonthStatistics {
  if (entries.length === 0) {
    return {
      totalEntries: 0,
      totalVideos: 0,
      totalPhotos: 0,
      totalTextEntries: 0,
      totalDurationSeconds: 0,
      entryIds: [],
      firstEntry: null,
      lastEntry: null,
    };
  }

  let totalVideos = 0;
  let totalPhotos = 0;
  let totalTextEntries = 0;
  let totalDurationSeconds = 0;
  const entryIds: string[] = [];

  for (const entry of entries) {
    entryIds.push(entry.id);

    switch (entry.entryType) {
      case "video":
        totalVideos++;
        if (entry.durationSeconds) {
          totalDurationSeconds += entry.durationSeconds;
        }
        break;
      case "photo":
        totalPhotos++;
        break;
      case "text":
        totalTextEntries++;
        break;
    }
  }

  // Entries are already sorted by created_at ASC
  const firstEntry = entries[0];
  const lastEntry = entries[entries.length - 1];

  return {
    totalEntries: entries.length,
    totalVideos,
    totalPhotos,
    totalTextEntries,
    totalDurationSeconds,
    entryIds,
    firstEntry,
    lastEntry,
  };
}

/**
 * Generate a human-readable summary text describing the month's progress
 */
function generateSummaryText(
  statistics: MonthStatistics,
  month: string
): string {
  const monthName = getMonthName(month);

  if (statistics.totalEntries === 0) {
    return `No entries recorded in ${monthName}.`;
  }

  const parts: string[] = [];

  // Main entry count
  const entryWord = statistics.totalEntries === 1 ? "entry" : "entries";
  parts.push(`You made ${statistics.totalEntries} ${entryWord} in ${monthName}`);

  // Build the breakdown of entry types
  const typeParts: string[] = [];

  if (statistics.totalVideos > 0) {
    const videoWord = statistics.totalVideos === 1 ? "video" : "videos";
    typeParts.push(`${statistics.totalVideos} ${videoWord}`);
  }

  if (statistics.totalPhotos > 0) {
    const photoWord = statistics.totalPhotos === 1 ? "photo" : "photos";
    typeParts.push(`${statistics.totalPhotos} ${photoWord}`);
  }

  if (statistics.totalTextEntries > 0) {
    const textWord = statistics.totalTextEntries === 1 ? "text entry" : "text entries";
    typeParts.push(`${statistics.totalTextEntries} ${textWord}`);
  }

  // Combine type parts
  if (typeParts.length > 0) {
    if (typeParts.length === 1) {
      parts[0] += `, including ${typeParts[0]}`;
    } else if (typeParts.length === 2) {
      parts[0] += `, including ${typeParts[0]} and ${typeParts[1]}`;
    } else {
      const lastPart = typeParts.pop();
      parts[0] += `, including ${typeParts.join(", ")}, and ${lastPart}`;
    }
  }

  parts[0] += ".";

  // Add duration info if there are videos
  if (statistics.totalDurationSeconds > 0) {
    const formattedDuration = formatDuration(statistics.totalDurationSeconds);
    parts.push(`Total video duration: ${formattedDuration}.`);
  }

  return parts.join(" ");
}

/**
 * Format duration in seconds to a human-readable string
 */
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(" ");
}

/**
 * Generate a monthly report for a project
 *
 * @param projectId - The ID of the project to generate a report for
 * @param month - The month in YYYY-MM format
 * @param options - Optional configuration
 * @param options.skipEmpty - If true, skip creating report for months with no entries (default: true)
 * @param options.overwrite - If true, update existing report instead of failing (default: false)
 * @returns Result indicating success or failure
 */
export async function generateMonthlyReport(
  projectId: string,
  month: string,
  options: {
    skipEmpty?: boolean;
    overwrite?: boolean;
  } = {}
): Promise<ReportGenerationResult> {
  const { skipEmpty = true, overwrite = false } = options;

  // Validate month format
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return {
      success: false,
      reason: `Invalid month format: ${month}. Expected YYYY-MM.`,
    };
  }

  try {
    // Check if report already exists
    const reportsStore = useReportsStore.getState();
    const existingReport = await reportsStore.getReportByMonth(projectId, month);

    if (existingReport && !overwrite) {
      return {
        success: false,
        reason: `Report for ${month} already exists.`,
      };
    }

    // Get all entries for the month
    const entries = await getEntriesForMonth(projectId, month);

    // Handle empty months
    if (entries.length === 0 && skipEmpty) {
      return {
        success: true,
        skipped: true,
        reason: `No entries found for ${month}. Skipping report generation.`,
      };
    }

    // Calculate statistics
    const statistics = calculateStatistics(entries);

    // Generate summary text
    const summaryText = generateSummaryText(statistics, month);

    // Prepare report input
    const reportInput: CreateReportInput = {
      projectId,
      month,
      summaryText,
      entryIds: statistics.entryIds,
      firstEntryId: statistics.firstEntry?.id,
      lastEntryId: statistics.lastEntry?.id,
      totalEntries: statistics.totalEntries,
      totalVideos: statistics.totalVideos,
      totalPhotos: statistics.totalPhotos,
      totalTextEntries: statistics.totalTextEntries,
      totalDurationSeconds: statistics.totalDurationSeconds,
    };

    // Save report to database
    if (existingReport && overwrite) {
      // Update existing report
      const updatedReport = await reportsStore.updateReport(existingReport.id, {
        summaryText,
        entryIds: statistics.entryIds,
        firstEntryId: statistics.firstEntry?.id,
        lastEntryId: statistics.lastEntry?.id,
        totalEntries: statistics.totalEntries,
        totalVideos: statistics.totalVideos,
        totalPhotos: statistics.totalPhotos,
        totalTextEntries: statistics.totalTextEntries,
        totalDurationSeconds: statistics.totalDurationSeconds,
      });

      return {
        success: true,
        reportId: updatedReport.id,
      };
    } else {
      // Create new report
      const report = await reportsStore.createReport(reportInput);

      return {
        success: true,
        reportId: report.id,
      };
    }
  } catch (error) {
    return {
      success: false,
      reason: error instanceof Error ? error.message : "Failed to generate report",
    };
  }
}

/**
 * Generate reports for all months with entries for a project
 *
 * @param projectId - The ID of the project
 * @param options - Optional configuration
 * @returns Array of results for each month
 */
export async function generateAllReportsForProject(
  projectId: string,
  options: {
    skipEmpty?: boolean;
    overwrite?: boolean;
  } = {}
): Promise<ReportGenerationResult[]> {
  const db = await getDatabase();

  // Get all distinct months with entries for this project
  const months = await db.getAllAsync<{ month: string }>(
    `SELECT DISTINCT strftime('%Y-%m', created_at) as month
     FROM entries
     WHERE project_id = ?
       AND is_deleted = 0
     ORDER BY month DESC`,
    [projectId]
  );

  const results: ReportGenerationResult[] = [];

  for (const { month } of months) {
    const result = await generateMonthlyReport(projectId, month, options);
    results.push(result);
  }

  return results;
}

/**
 * Get the list of months that have entries but no reports for a project
 *
 * @param projectId - The ID of the project
 * @returns Array of months in YYYY-MM format
 */
export async function getMonthsWithoutReports(projectId: string): Promise<string[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{ month: string }>(
    `SELECT DISTINCT strftime('%Y-%m', e.created_at) as month
     FROM entries e
     WHERE e.project_id = ?
       AND e.is_deleted = 0
       AND NOT EXISTS (
         SELECT 1 FROM reports r
         WHERE r.project_id = e.project_id
           AND r.month = strftime('%Y-%m', e.created_at)
       )
     ORDER BY month DESC`,
    [projectId]
  );

  return rows.map((r) => r.month);
}
