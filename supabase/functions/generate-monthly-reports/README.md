# Generate Monthly Reports Edge Function

This Supabase Edge Function automatically generates monthly progress reports for all active users/projects.

## Overview

The function:
- Queries all active projects (optionally filtered by user)
- For each project, checks if entries exist for the specified month
- Generates a report with statistics and summary text (matching mobile app logic)
- Stores reports in the PostgreSQL `reports` table
- Handles edge cases (no entries, already generated, deleted projects)

## API Reference

### Endpoint

```
POST /functions/v1/generate-monthly-reports
```

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes* | Bearer token for authenticated users |
| `x-cron-secret` | Yes* | Secret for scheduled job authentication |

*Either `Authorization` or `x-cron-secret` is required.

### Request Body

```json
{
  "userId": "optional-user-uuid",
  "month": "2024-01",
  "overwrite": false
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `userId` | string | - | Generate reports for specific user only. If omitted, generates for all users. |
| `month` | string | Previous month | Month in YYYY-MM format. Defaults to the previous calendar month. |
| `overwrite` | boolean | false | If true, regenerates existing reports with updated data. |

### Response

```json
{
  "success": true,
  "message": "Successfully processed 5 project(s)",
  "results": [
    {
      "projectId": "project-uuid",
      "projectName": "My Fitness Journey",
      "month": "2024-01",
      "success": true,
      "reportId": "report-uuid"
    },
    {
      "projectId": "project-uuid-2",
      "projectName": "Learning Piano",
      "month": "2024-01",
      "success": true,
      "skipped": true,
      "reason": "No entries found for this month"
    }
  ],
  "summary": {
    "total": 5,
    "generated": 3,
    "skipped": 2,
    "failed": 0
  }
}
```

## Manual Invocation

### Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions**
3. Select `generate-monthly-reports`
4. Click **Invoke** in the top right
5. Add request body (optional):
   ```json
   {
     "month": "2024-01"
   }
   ```
6. Click **Run**

### Using cURL

```bash
# Generate reports for all users (previous month)
curl -X POST \
  'https://your-project.supabase.co/functions/v1/generate-monthly-reports' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json'

# Generate reports for specific user
curl -X POST \
  'https://your-project.supabase.co/functions/v1/generate-monthly-reports' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"userId": "user-uuid-here"}'

# Generate reports for specific month with overwrite
curl -X POST \
  'https://your-project.supabase.co/functions/v1/generate-monthly-reports' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"month": "2024-01", "overwrite": true}'
```

### Using Supabase Client (JavaScript)

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { data, error } = await supabase.functions.invoke('generate-monthly-reports', {
  body: {
    month: '2024-01',
    overwrite: false
  }
});

console.log(data);
// {
//   success: true,
//   message: 'Successfully processed 5 project(s)',
//   results: [...],
//   summary: { total: 5, generated: 3, skipped: 2, failed: 0 }
// }
```

## Setting Up Scheduled Jobs with pg_cron

### Prerequisites

1. Enable the `pg_cron` extension in your Supabase project:
   - Go to **Database** > **Extensions**
   - Search for `pg_cron`
   - Click **Enable**

2. Set up environment variables:
   - Go to **Settings** > **Edge Functions**
   - Add `CRON_SECRET` with a secure random string

### Creating the Scheduled Job

Run the following SQL in the Supabase SQL Editor:

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create the scheduled job to run on the 1st of every month at 2:00 AM UTC
SELECT cron.schedule(
  'generate-monthly-reports',           -- Job name
  '0 2 1 * *',                          -- Cron expression: 2:00 AM on 1st of each month
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-monthly-reports',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', 'YOUR_CRON_SECRET'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

**Important:** Replace:
- `YOUR_PROJECT_REF` with your Supabase project reference (e.g., `abcdefghijklmnop`)
- `YOUR_CRON_SECRET` with the secret you set in Edge Functions settings

### Alternative: Using pg_net Extension

If `pg_cron` doesn't work with your plan, you can use a combination of `pg_cron` and `pg_net`:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the scheduled job
SELECT cron.schedule(
  'generate-monthly-reports',
  '0 2 1 * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-monthly-reports',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "YOUR_CRON_SECRET"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

### Managing Scheduled Jobs

```sql
-- List all scheduled jobs
SELECT * FROM cron.job;

-- View job run history
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'generate-monthly-reports')
ORDER BY start_time DESC
LIMIT 10;

-- Unschedule the job
SELECT cron.unschedule('generate-monthly-reports');

-- Run the job immediately (for testing)
SELECT cron.schedule(
  'generate-monthly-reports-now',
  '* * * * *',  -- Run every minute (temporary)
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-monthly-reports',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "YOUR_CRON_SECRET"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Don't forget to unschedule the test job!
SELECT cron.unschedule('generate-monthly-reports-now');
```

### Cron Expression Reference

| Expression | Description |
|------------|-------------|
| `0 2 1 * *` | 2:00 AM on the 1st of every month |
| `0 0 1 * *` | Midnight on the 1st of every month |
| `0 8 1 * *` | 8:00 AM on the 1st of every month |
| `0 2 1 */3 *` | 2:00 AM on the 1st of every 3 months |

Format: `minute hour day_of_month month day_of_week`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Automatically provided by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Automatically provided by Supabase |
| `CRON_SECRET` | Recommended | Secret for authenticating scheduled job requests |
| `ALLOW_UNAUTHENTICATED_CRON` | No | Set to `true` to allow unauthenticated calls (testing only) |

## Database Schema Requirements

The function expects the following tables to exist:

### projects

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  -- ... other columns
);
```

### entries

```sql
CREATE TABLE entries (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('video', 'photo', 'text')),
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  -- ... other columns
);
```

### reports

```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  month TEXT NOT NULL,
  summary_text TEXT,
  entry_ids TEXT,
  first_entry_id UUID,
  last_entry_id UUID,
  total_entries INTEGER DEFAULT 0,
  total_videos INTEGER DEFAULT 0,
  total_photos INTEGER DEFAULT 0,
  total_text_entries INTEGER DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, month)
);
```

## Deployment

Deploy the function using Supabase CLI:

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy generate-monthly-reports

# Set the CRON_SECRET (recommended)
supabase secrets set CRON_SECRET=your-secure-random-string
```

## Error Handling

The function includes comprehensive error handling:

- **Authentication failures**: Returns 401 with error message
- **Invalid parameters**: Returns 400 with validation error
- **Database errors**: Logged and included in per-project results
- **Partial failures**: Reports are generated independently; one failure doesn't stop others

## Logging

All operations are logged to the Edge Function logs:

```
=== Starting monthly report generation ===
Parameters: userId=all, month=2024-01, overwrite=false
Found 5 active project(s)
Created: Report for project My Fitness Journey (2024-01)
Skipped: No entries for project Learning Piano (2024-01)
Created: Report for project Photography (2024-01)
=== Report generation complete: 3 generated, 2 skipped, 0 failed ===
```

View logs in the Supabase Dashboard under **Edge Functions** > **Logs**.
