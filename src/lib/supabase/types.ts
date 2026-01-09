/**
 * Database type definitions for Supabase.
 *
 * This file can be auto-generated using the Supabase CLI:
 * npx supabase gen types typescript --project-id <your-project-id> --schema public > src/lib/supabase/types.ts
 *
 * For now, we define a minimal type structure that matches our app's data models.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          category: string;
          cover_image_url: string | null;
          start_date: string;
          end_date: string | null;
          reminder_time: string | null;
          reminder_days: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          category: string;
          cover_image_url?: string | null;
          start_date: string;
          end_date?: string | null;
          reminder_time?: string | null;
          reminder_days?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          category?: string;
          cover_image_url?: string | null;
          start_date?: string;
          end_date?: string | null;
          reminder_time?: string | null;
          reminder_days?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      entries: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          entry_type: string;
          content_text: string | null;
          media_url: string | null;
          thumbnail_url: string | null;
          duration_seconds: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          entry_type: string;
          content_text?: string | null;
          media_url?: string | null;
          thumbnail_url?: string | null;
          duration_seconds?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          entry_type?: string;
          content_text?: string | null;
          media_url?: string | null;
          thumbnail_url?: string | null;
          duration_seconds?: number | null;
          created_at?: string;
        };
      };
      reports: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          month: string;
          summary_text: string | null;
          entry_ids: string[] | null;
          first_entry_id: string | null;
          last_entry_id: string | null;
          total_entries: number;
          total_videos: number;
          total_photos: number;
          total_text_entries: number;
          total_duration_seconds: number;
          generated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          month: string;
          summary_text?: string | null;
          entry_ids?: string[] | null;
          first_entry_id?: string | null;
          last_entry_id?: string | null;
          total_entries?: number;
          total_videos?: number;
          total_photos?: number;
          total_text_entries?: number;
          total_duration_seconds?: number;
          generated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          month?: string;
          summary_text?: string | null;
          entry_ids?: string[] | null;
          first_entry_id?: string | null;
          last_entry_id?: string | null;
          total_entries?: number;
          total_videos?: number;
          total_photos?: number;
          total_text_entries?: number;
          total_duration_seconds?: number;
          generated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
