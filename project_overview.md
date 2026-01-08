# Progress Tracker - Personal Progress Tracking App

## Project Description
A React Native mobile app for tracking personal progress over time. Users create "projects" (e.g., learning guitar, gym progress) and upload daily entries including videos, photos, or text notes. The app sends configurable reminders and generates monthly progress reports showing the journey from start to current state.

The key insight: It's hard to see progress day-by-day because changes are small. But over months or a year, the difference is significant. This app helps capture those daily moments and reveals the bigger picture of personal growth.

## Use Cases
- **Learning Guitar**: Record 2-3 minute daily videos of playing, see progression from struggling with basic chords to fluid playing over months
- **Gym Progress**: Take daily physique photos, visualize body transformation over time
- **Any Skill/Habit**: Track any personal improvement project with consistent documentation

## Tech Stack
- **Framework**: Expo SDK 51+ (managed workflow)
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand (local state) + TanStack Query (server state)
- **Local Database**: Expo SQLite (offline-first)
- **Remote Database**: Supabase (PostgreSQL with Row Level Security)
- **Cloud Storage**: Cloudflare R2 (zero egress fees for video streaming)
- **Notifications**: Expo Notifications + Push notifications
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Media**: expo-av (video recording/playback), expo-image-picker

## Design System

### Color Palette
- **Background**: Dark theme primary (`#0a0a0a`)
- **Surface**: Card backgrounds (`#1a1a1a`)
- **Primary**: Accent color (`#6366f1` - Indigo)
- **Success**: Progress indicators (`#22c55e`)
- **Text Primary**: White (`#ffffff`)
- **Text Secondary**: Muted gray (`#a1a1aa`)

### Typography
- Clean, modern sans-serif (System default or Inter)
- Monospace for dates/timestamps
- Large, readable text for entries

### Design Principles
- Mobile-first (iOS + Android)
- Offline-first (works without internet, syncs when available)
- Minimal friction for daily entries
- Visual progress focus
- Generous whitespace
- Smooth animations for engagement

## Screens & Navigation

### Authentication Flow
```
(auth)/
├── welcome.tsx        # App intro with value proposition
├── login.tsx          # Email/password + social auth
├── register.tsx       # Account creation
└── forgot-password.tsx
```

### Main App (Tab Navigation)
```
(tabs)/
├── index.tsx          # Projects List (Home)
├── calendar.tsx       # Calendar View (all projects)
└── profile.tsx        # Settings & Profile
```

### Project Screens
```
project/
├── [id].tsx           # Project Detail (timeline preview, stats)
├── create.tsx         # New Project Wizard
├── edit/[id].tsx      # Edit Project Settings
└── timeline/[id].tsx  # Full Timeline View
```

### Entry Screens
```
entry/
├── create/[projectId].tsx  # Entry type selection
├── camera/[projectId].tsx  # Video/Photo capture
└── view/[id].tsx           # Entry detail / Media viewer
```

### Report Screens
```
report/
├── [id].tsx               # Report Detail (comparison view)
└── list/[projectId].tsx   # Report History
```

### Settings Screens
```
settings/
├── notifications.tsx  # Notification preferences
├── storage.tsx        # Storage management
└── account.tsx        # Account settings
```

## Data Models

### Local SQLite Schema

```sql
-- Projects: Tracking projects created by user
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,                    -- 'fitness', 'learning', 'creative', 'custom'
  cover_image_uri TEXT,
  start_date TEXT NOT NULL,
  reminder_time TEXT,               -- HH:MM format
  reminder_days TEXT,               -- JSON array ['mon','tue','wed'...]
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT,                   -- Last cloud sync
  is_deleted INTEGER DEFAULT 0      -- Soft delete
);

-- Entries: Daily progress entries
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  entry_type TEXT NOT NULL,         -- 'video', 'photo', 'text'
  content_text TEXT,                -- Text content or caption
  media_uri TEXT,                   -- Local file path
  media_remote_url TEXT,            -- Cloud storage URL
  thumbnail_uri TEXT,               -- Video thumbnail
  duration_seconds INTEGER,         -- Video duration
  created_at TEXT NOT NULL,
  synced_at TEXT,
  upload_status TEXT DEFAULT 'pending', -- 'pending', 'uploading', 'uploaded', 'failed'
  is_deleted INTEGER DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Reports: Monthly progress reports
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  month TEXT NOT NULL,              -- 'YYYY-MM'
  summary_text TEXT,
  first_entry_id TEXT,
  last_entry_id TEXT,
  total_entries INTEGER,
  generated_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Notification Settings: Per-project reminders
CREATE TABLE notification_settings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  time TEXT NOT NULL,               -- HH:MM
  days TEXT NOT NULL,               -- JSON array of days
  last_sent_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Sync Queue: Offline operation queue
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL,          -- 'create', 'update', 'delete'
  payload TEXT,                     -- JSON
  created_at TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_attempt_at TEXT,
  error_message TEXT
);

-- Indexes for performance
CREATE INDEX idx_entries_project ON entries(project_id);
CREATE INDEX idx_entries_created ON entries(created_at DESC);
CREATE INDEX idx_sync_queue_attempts ON sync_queue(attempts);
```

### TypeScript Interfaces

```typescript
type EntryType = 'video' | 'photo' | 'text';
type UploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';
type ProjectCategory = 'fitness' | 'learning' | 'creative' | 'custom';

interface Project {
  id: string;
  name: string;
  description?: string;
  category: ProjectCategory;
  coverImageUri?: string;
  startDate: string;
  reminderTime?: string;
  reminderDays?: string[];
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  isDeleted: boolean;
}

interface Entry {
  id: string;
  projectId: string;
  entryType: EntryType;
  contentText?: string;
  mediaUri?: string;
  mediaRemoteUrl?: string;
  thumbnailUri?: string;
  durationSeconds?: number;
  createdAt: string;
  syncedAt?: string;
  uploadStatus: UploadStatus;
  isDeleted: boolean;
}

interface Report {
  id: string;
  projectId: string;
  month: string;
  summaryText?: string;
  firstEntryId?: string;
  lastEntryId?: string;
  totalEntries: number;
  generatedAt: string;
}
```

## Key Features

### 1. Project Management
- Create projects with name, description, category
- Set cover image for visual identification
- Configure reminder schedule (time + days of week)
- View project statistics (total entries, streak, first/last entry)

### 2. Entry Creation
- **Video**: Record up to 3 minutes, auto-generate thumbnail
- **Photo**: Capture or select from gallery, compress before storage
- **Text**: Quick text notes for days without media
- All entries support optional captions

### 3. Timeline View
- Vertical scrolling list of all entries
- Date headers for grouping
- Entry cards showing thumbnail/preview
- Full-screen media viewer on tap
- Calendar grid view option

### 4. Cloud Sync
- Offline-first: Works without internet
- Background upload queue with retry logic
- Chunked video upload for reliability
- Sync status indicators in UI
- Conflict resolution for concurrent edits

### 5. Notifications
- Configurable per-project reminders
- "What's your progress on [Project] today?"
- Streak alerts ("Don't break your X-day streak!")
- Monthly report ready notifications

### 6. Monthly Reports
- Auto-generated on 1st of each month
- Side-by-side comparison: first entry vs latest entry
- Statistics: total entries, active days, longest streak
- Share as image to social media

## Notification Types

| Type | Trigger | Content |
|------|---------|---------|
| Daily Reminder | User-scheduled time | "What's your progress on Guitar today?" |
| Streak Alert | 2 days without entry | "Don't break your 15-day streak on Gym!" |
| Monthly Report | 1st of month | "Your January progress report for Guitar is ready!" |
| Upload Complete | Background sync done | "3 entries synced successfully" |
| Weekly Summary | Sunday evening | "You logged 5 entries this week. Keep it up!" |

## Cloud Architecture

```
Mobile App (Expo)
    │
    ├── Local SQLite DB (offline-first)
    │
    └── Sync Layer
          │
          ▼
    Supabase
    ├── Auth (Email, Google, Apple)
    ├── PostgreSQL (projects, entries metadata)
    ├── Edge Functions (pre-signed URLs, report generation)
    └── Storage OR Cloudflare R2
              │
              ▼
         CDN (cached media delivery)
```

### Upload Flow
1. User captures video/photo
2. Save to device, create thumbnail
3. Add to local SQLite with `upload_status: 'pending'`
4. Queue for background upload
5. Request pre-signed URL from Supabase Edge Function
6. Upload directly to R2/Storage (chunked for video)
7. Update local DB with remote URL, mark as 'uploaded'
8. Optionally clean up local file

## Milestones

### Milestone 1: Project Scaffolding & Core Setup
Initialize Expo project with TypeScript, configure dependencies, establish folder structure, set up Expo Router with tab navigation, configure NativeWind styling, and define base theme.

### Milestone 2: Local Database & State Management
Implement offline-first SQLite database with schema for projects, entries, reports, and sync queue. Create Zustand stores and custom hooks (useProject, useEntries) for data access.

### Milestone 3: Authentication & User Management
Implement Supabase auth with email/password, Google OAuth, and Apple Sign-In. Create onboarding flow, profile screen, and secure token storage.

### Milestone 4: Project Management UI
Build project list (home), create project wizard, project detail screen with stats, edit/delete functionality, category selection, and cover image picker.

### Milestone 5: Media Capture & Entry Creation
Implement camera screen with video/photo toggle, video recording (max 3 min), photo capture, text entries, media preview, thumbnail generation, and compression.

### Milestone 6: Timeline View & Entry Management
Build visual timeline component, entry cards (video/photo/text), full-screen media viewer, calendar view option, entry filtering, and date-grouped sorting.

### Milestone 7: Cloud Sync & Media Upload
Integrate Cloudflare R2 via Supabase Edge Functions, implement chunked video upload with progress, background upload queue with retry logic, and offline/online handling.

### Milestone 8: Push Notifications & Reminders
Set up expo-notifications, implement per-project reminder scheduling (time + days), push notification registration, deep linking on tap, and permission flow.

### Milestone 9: Monthly Reports Generation
Create report generation logic (first vs last entry comparison), side-by-side comparison view, progress statistics, report sharing, and Supabase scheduled function for auto-generation.

### Milestone 10: Polish, Testing & App Store Prep
Error boundaries, crash reporting (Sentry), performance optimization, accessibility audit, unit/E2E tests, app icons, splash screen, and EAS Build configuration.

### Milestone 11: Continuous Improvement (Never Complete)
Research similar apps (Day One, Journey, Momento, 1 Second Everyday, Gyroscope) and identify new features. This perpetual milestone allows for continuous market research, UX improvements, and feature discovery.

## Development Guidelines

### Code Style
- Use TypeScript strictly
- Follow Expo Router conventions
- Organize by feature (screens, components per feature)
- Prefer functional components with hooks
- Use async/await over promises

### Component Structure
```
src/
├── app/                    # Expo Router pages
│   ├── (auth)/
│   ├── (tabs)/
│   ├── project/
│   ├── entry/
│   └── report/
├── components/
│   ├── ui/                 # Base UI components
│   ├── project/            # Project-related components
│   ├── entry/              # Entry-related components
│   ├── timeline/           # Timeline components
│   └── shared/             # Reusable components
├── lib/
│   ├── db/                 # SQLite operations
│   ├── store/              # Zustand stores
│   ├── hooks/              # Custom hooks
│   ├── supabase/           # Supabase client
│   └── utils/              # Utility functions
├── types/                  # TypeScript types
└── constants/              # App constants
```

### Performance Guidelines
- Use FlatList/FlashList for long lists
- Lazy load images and video thumbnails
- Compress media before storage
- Use memo/useMemo for expensive computations
- Background upload to avoid UI blocking

### Offline-First Principles
- Always write to local DB first
- Queue operations for sync
- Show local data immediately
- Indicate sync status clearly
- Handle conflicts gracefully

## Notes
- The core value is revealing progress over time - prioritize the comparison/report feature
- Entry creation should be as frictionless as possible (one tap to start recording)
- Offline support is critical - users may want to record in areas without connectivity
- Video storage will be the main cost driver - implement compression and consider retention policies
- Push notification permissions are crucial - explain value clearly during onboarding
