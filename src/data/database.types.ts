/**
 * Matches supabase/migrations. Regenerate against a running local stack with:
 * npx supabase gen types typescript --local > src/data/database.types.ts
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          day_switch: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          day_switch?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          day_switch?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      weight_records: {
        Row: {
          id: string;
          user_id: string;
          weight_kg: number;
          recorded_at: string;
          tz: string;
          local_day: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          user_id?: string;
          weight_kg: number;
          recorded_at: string;
          tz: string;
          local_day: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          weight_kg?: number;
          recorded_at?: string;
          tz?: string;
          local_day?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      training_sets: {
        Row: {
          id: string;
          user_id: string;
          exercise: string;
          reps: number;
          weight_kg: number | null;
          band_level: string | null;
          recorded_at: string;
          tz: string;
          local_day: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          user_id?: string;
          exercise: string;
          reps: number;
          weight_kg?: number | null;
          band_level?: string | null;
          recorded_at: string;
          tz: string;
          local_day: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          exercise?: string;
          reps?: number;
          weight_kg?: number | null;
          band_level?: string | null;
          recorded_at?: string;
          tz?: string;
          local_day?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      soft_delete_weight_record: {
        Args: { target: string };
        Returns: undefined;
      };
    };
  };
};
