import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// Types
// =============================================================================

interface RequestBody {
  userId?: string; // Optional: generate for specific user only
  month?: string; // Optional: specific month in YYYY-MM format (defaults to previous month)
  overwrite?: boolean; // Optional: overwrite existing reports (default: false)
}

interface Entry {
  id: string;
  project_id: string;
  entry_type: "video" | "photo" | "text";
  content_text: string | null;
  media_uri: string | null;
  media_remote_url: string | null;
  thumbnail_uri: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  upload_status: string;
  is_deleted: boolean;
}

interface Project {
  id: string;
  user_id: string;
  name: string;
  is_deleted: boolean;
}

interface Report {
  id: string;
  project_id: string;
  month: string;
  summary_text: string | null;
  entry_ids: string | null;
  first_entry_id: string | null;
  last_entry_id: string | null;
  total_entries: number;
  total_videos: number;
  total_photos: number;
  total_text_entries: number;
  total_duration_seconds: number;
  generated_at: string;
}

interface MonthStatistics {
  totalEntries: number;
  totalVideos: number;
  totalPhotos: number;
  totalTextEntries: number;
  totalDurationSeconds: number;
  entryIds: string[];
  firstEntryId: string | null;
  lastEntryId: string | null;
}

interface GenerationResult {
  projectId: string;
  projectName: string;
  month: string;
  success: boolean;
  reportId?: string;
  skipped?: boolean;
  reason?: string;
}

interface ResponseBody {
  success: boolean;
  message: string;
  results: GenerationResult[];
  summary: {
    total: number;
    generated: number;
    skipped: number;
    failed: number;
  };
}

// =============================================================================
// CORS Headers
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the previous month in YYYY-MM format
 */
function getPreviousMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed, so this is already "previous month"

  if (month === 0) {
    // January -> December of previous year
    return `${year - 1}-12`;
  }

  return `${year}-${String(month).padStart(2, "0")}`;
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
      firstEntryId: null,
      lastEntryId: null,
    };
  }

  let totalVideos = 0;
  let totalPhotos = 0;
  let totalTextEntries = 0;
  let totalDurationSeconds = 0;
  const entryIds: string[] = [];

  for (const entry of entries) {
    entryIds.push(entry.id);

    switch (entry.entry_type) {
      case "video":
        totalVideos++;
        if (entry.duration_seconds) {
          totalDurationSeconds += entry.duration_seconds;
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

  // Entries should be sorted by created_at ASC
  const firstEntryId = entries[0].id;
  const lastEntryId = entries[entries.length - 1].id;

  return {
    totalEntries: entries.length,
    totalVideos,
    totalPhotos,
    totalTextEntries,
    totalDurationSeconds,
    entryIds,
    firstEntryId,
    lastEntryId,
  };
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
 * Generate a human-readable summary text describing the month's progress
 */
function generateSummaryText(statistics: MonthStatistics, month: string): string {
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
 * Validate month format (YYYY-MM)
 */
function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

// =============================================================================
// Database Operations
// =============================================================================

/**
 * Get all active projects, optionally filtered by user
 */
async function getActiveProjects(
  supabase: SupabaseClient,
  userId?: string
): Promise<Project[]> {
  let query = supabase
    .from("projects")
    .select("id, user_id, name, is_deleted")
    .eq("is_deleted", false);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching projects:", error);
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }

  return data || [];
}

/**
 * Get entries for a project within a specific month
 */
async function getEntriesForMonth(
  supabase: SupabaseClient,
  projectId: string,
  month: string
): Promise<Entry[]> {
  const { startDate, endDate } = getMonthDateRange(month);

  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_deleted", false)
    .gte("created_at", `${startDate}T00:00:00.000Z`)
    .lte("created_at", `${endDate}T23:59:59.999Z`)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(`Error fetching entries for project ${projectId}:`, error);
    throw new Error(`Failed to fetch entries: ${error.message}`);
  }

  return data || [];
}

/**
 * Check if a report already exists for a project and month
 */
async function getExistingReport(
  supabase: SupabaseClient,
  projectId: string,
  month: string
): Promise<Report | null> {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("project_id", projectId)
    .eq("month", month)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found
    console.error(`Error checking existing report for project ${projectId}:`, error);
    throw new Error(`Failed to check existing report: ${error.message}`);
  }

  return data;
}

/**
 * Create a new report in the database
 */
async function createReport(
  supabase: SupabaseClient,
  projectId: string,
  month: string,
  statistics: MonthStatistics,
  summaryText: string
): Promise<string> {
  const reportId = generateUUID();
  const now = new Date().toISOString();

  const report = {
    id: reportId,
    project_id: projectId,
    month,
    summary_text: summaryText,
    entry_ids: JSON.stringify(statistics.entryIds),
    first_entry_id: statistics.firstEntryId,
    last_entry_id: statistics.lastEntryId,
    total_entries: statistics.totalEntries,
    total_videos: statistics.totalVideos,
    total_photos: statistics.totalPhotos,
    total_text_entries: statistics.totalTextEntries,
    total_duration_seconds: statistics.totalDurationSeconds,
    generated_at: now,
  };

  const { error } = await supabase.from("reports").insert(report);

  if (error) {
    console.error(`Error creating report for project ${projectId}:`, error);
    throw new Error(`Failed to create report: ${error.message}`);
  }

  return reportId;
}

/**
 * Update an existing report in the database
 */
async function updateReport(
  supabase: SupabaseClient,
  reportId: string,
  statistics: MonthStatistics,
  summaryText: string
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("reports")
    .update({
      summary_text: summaryText,
      entry_ids: JSON.stringify(statistics.entryIds),
      first_entry_id: statistics.firstEntryId,
      last_entry_id: statistics.lastEntryId,
      total_entries: statistics.totalEntries,
      total_videos: statistics.totalVideos,
      total_photos: statistics.totalPhotos,
      total_text_entries: statistics.totalTextEntries,
      total_duration_seconds: statistics.totalDurationSeconds,
      generated_at: now,
    })
    .eq("id", reportId);

  if (error) {
    console.error(`Error updating report ${reportId}:`, error);
    throw new Error(`Failed to update report: ${error.message}`);
  }
}

// =============================================================================
// Report Generation Logic
// =============================================================================

/**
 * Generate a report for a single project and month
 */
async function generateReportForProject(
  supabase: SupabaseClient,
  project: Project,
  month: string,
  overwrite: boolean
): Promise<GenerationResult> {
  const result: GenerationResult = {
    projectId: project.id,
    projectName: project.name,
    month,
    success: false,
  };

  try {
    // Check if report already exists
    const existingReport = await getExistingReport(supabase, project.id, month);

    if (existingReport && !overwrite) {
      result.success = true;
      result.skipped = true;
      result.reason = "Report already exists";
      result.reportId = existingReport.id;
      console.log(`Skipped: Report already exists for project ${project.name} (${month})`);
      return result;
    }

    // Get entries for the month
    const entries = await getEntriesForMonth(supabase, project.id, month);

    // Skip if no entries
    if (entries.length === 0) {
      result.success = true;
      result.skipped = true;
      result.reason = "No entries found for this month";
      console.log(`Skipped: No entries for project ${project.name} (${month})`);
      return result;
    }

    // Calculate statistics
    const statistics = calculateStatistics(entries);

    // Generate summary text
    const summaryText = generateSummaryText(statistics, month);

    // Create or update report
    if (existingReport && overwrite) {
      await updateReport(supabase, existingReport.id, statistics, summaryText);
      result.success = true;
      result.reportId = existingReport.id;
      console.log(`Updated: Report for project ${project.name} (${month})`);
    } else {
      const reportId = await createReport(supabase, project.id, month, statistics, summaryText);
      result.success = true;
      result.reportId = reportId;
      console.log(`Created: Report for project ${project.name} (${month})`);
    }

    return result;
  } catch (error) {
    result.success = false;
    result.reason = error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed: Report generation for project ${project.name} (${month}):`, error);
    return result;
  }
}

// =============================================================================
// Authentication & Authorization
// =============================================================================

/**
 * Verify the request has valid service role or admin authentication
 * For scheduled jobs, we use the service role key
 * For manual API calls, we can optionally verify the calling user is an admin
 */
async function verifyAuth(
  req: Request
): Promise<{ authorized: true; supabase: SupabaseClient } | { authorized: false; error: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      authorized: false,
      error: "Server configuration error: Missing Supabase credentials",
    };
  }

  // Create service role client for database operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Check for Authorization header
  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    // For scheduled jobs (pg_cron), there may be no auth header
    // We rely on the service role key being used directly
    // In production, you might want to add additional security measures
    // such as a shared secret or IP allowlist
    const cronSecret = Deno.env.get("CRON_SECRET");
    const providedSecret = req.headers.get("x-cron-secret");

    if (cronSecret && providedSecret === cronSecret) {
      console.log("Authenticated via CRON_SECRET");
      return { authorized: true, supabase };
    }

    // Allow unauthenticated calls only if a specific env var is set (for testing)
    const allowUnauthenticated = Deno.env.get("ALLOW_UNAUTHENTICATED_CRON");
    if (allowUnauthenticated === "true") {
      console.log("Allowing unauthenticated call (ALLOW_UNAUTHENTICATED_CRON=true)");
      return { authorized: true, supabase };
    }

    return {
      authorized: false,
      error: "Missing authorization header",
    };
  }

  // Verify the JWT token
  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return {
      authorized: false,
      error: "Invalid or expired token",
    };
  }

  // Optionally check if user is an admin
  // You can implement this based on your user roles table or metadata
  // For now, we allow any authenticated user to trigger for their own userId
  console.log(`Authenticated as user: ${user.id}`);

  return { authorized: true, supabase };
}

// =============================================================================
// Main Handler
// =============================================================================

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Method not allowed",
        results: [],
        summary: { total: 0, generated: 0, skipped: 0, failed: 0 },
      }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log("=== Starting monthly report generation ===");

  try {
    // Verify authentication
    const authResult = await verifyAuth(req);
    if (!authResult.authorized) {
      console.error("Authorization failed:", authResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          message: authResult.error,
          results: [],
          summary: { total: 0, generated: 0, skipped: 0, failed: 0 },
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { supabase } = authResult;

    // Parse request body
    let body: RequestBody = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body is allowed, use defaults
    }

    const { userId, overwrite = false } = body;
    const month = body.month || getPreviousMonth();

    // Validate month format
    if (!isValidMonth(month)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Invalid month format: ${month}. Expected YYYY-MM.`,
          results: [],
          summary: { total: 0, generated: 0, skipped: 0, failed: 0 },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Parameters: userId=${userId || "all"}, month=${month}, overwrite=${overwrite}`);

    // Get all active projects
    const projects = await getActiveProjects(supabase, userId);
    console.log(`Found ${projects.length} active project(s)`);

    if (projects.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No active projects found",
          results: [],
          summary: { total: 0, generated: 0, skipped: 0, failed: 0 },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate reports for all projects
    const results: GenerationResult[] = [];
    for (const project of projects) {
      const result = await generateReportForProject(supabase, project, month, overwrite);
      results.push(result);
    }

    // Calculate summary
    const summary = {
      total: results.length,
      generated: results.filter((r) => r.success && !r.skipped).length,
      skipped: results.filter((r) => r.skipped).length,
      failed: results.filter((r) => !r.success).length,
    };

    console.log(
      `=== Report generation complete: ${summary.generated} generated, ${summary.skipped} skipped, ${summary.failed} failed ===`
    );

    const response: ResponseBody = {
      success: summary.failed === 0,
      message:
        summary.failed === 0
          ? `Successfully processed ${summary.total} project(s)`
          : `Completed with ${summary.failed} failure(s)`,
      results,
      summary,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "An unexpected error occurred",
        results: [],
        summary: { total: 0, generated: 0, skipped: 0, failed: 0 },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
