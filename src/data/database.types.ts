/**
 * Matches supabase/migrations. Regenerate against a running local stack with:
 * npx supabase gen types typescript --local --schema public > src/data/database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      account_balances: {
        Row: {
          account_id: string;
          amount: number;
          created_at: string;
          deleted_at: string | null;
          id: string;
          local_day: string;
          recorded_at: string;
          tz: string;
          updated_at: string;
          usd_rate: number | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          account_id: string;
          amount: number;
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          local_day: string;
          recorded_at: string;
          tz: string;
          updated_at?: string;
          usd_rate?: number | null;
          user_id: string;
        };
        Update: {
          account_id?: string;
          amount?: number;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          local_day?: string;
          recorded_at?: string;
          tz?: string;
          updated_at?: string;
          usd_rate?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_balances_account_fkey";
            columns: ["account_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "asset_accounts";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      asset_accounts: {
        Row: {
          created_at: string;
          currency: string;
          deleted_at: string | null;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          currency: string;
          deleted_at?: string | null;
          id: string;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      asset_events: {
        Row: {
          after_quantity: number | null;
          after_usd: number | null;
          before_quantity: number | null;
          before_usd: number | null;
          goal_id: string | null;
          holding_id: string | null;
          id: string;
          kind: string;
          occurred_at: string;
          symbol: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          after_quantity?: number | null;
          after_usd?: number | null;
          before_quantity?: number | null;
          before_usd?: number | null;
          goal_id?: string | null;
          holding_id?: string | null;
          id?: string;
          kind: string;
          occurred_at?: string;
          symbol?: string | null;
          user_id: string;
        };
        Update: {
          after_quantity?: number | null;
          after_usd?: number | null;
          before_quantity?: number | null;
          before_usd?: number | null;
          goal_id?: string | null;
          holding_id?: string | null;
          id?: string;
          kind?: string;
          occurred_at?: string;
          symbol?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      fx_rates: {
        Row: {
          as_of: string;
          base: string;
          quote: string;
          rate: number;
        };
        ComputedFields: never;
        Insert: {
          as_of: string;
          base: string;
          quote: string;
          rate: number;
        };
        Update: {
          as_of?: string;
          base?: string;
          quote?: string;
          rate?: number;
        };
        Relationships: [];
      };
      holdings: {
        Row: {
          account_id: string;
          cost_basis_usd: number | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          quantity: number;
          symbol: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          account_id: string;
          cost_basis_usd?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          quantity: number;
          symbol: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          cost_basis_usd?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          quantity?: number;
          symbol?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "holdings_account_fkey";
            columns: ["account_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "asset_accounts";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      journal_entries: {
        Row: {
          body: string;
          created_at: string;
          deleted_at: string | null;
          entry_day: string;
          id: string;
          mood: number | null;
          tags: string[];
          tz: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          entry_day: string;
          id: string;
          mood?: number | null;
          tags?: string[];
          tz: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          entry_day?: string;
          id?: string;
          mood?: number | null;
          tags?: string[];
          tz?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      net_worth_goals: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          target_date: string | null;
          target_usd: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          target_date?: string | null;
          target_usd: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          target_date?: string | null;
          target_usd?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      net_worth_snapshots: {
        Row: {
          as_of: string;
          cash_usd: number;
          local_day: string;
          securities_usd: number;
          total_usd: number;
          tz: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          as_of: string;
          cash_usd: number;
          local_day: string;
          securities_usd: number;
          total_usd: number;
          tz: string;
          user_id: string;
        };
        Update: {
          as_of?: string;
          cash_usd?: number;
          local_day?: string;
          securities_usd?: number;
          total_usd?: number;
          tz?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          day_switch: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          day_switch?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          day_switch?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      projection_assumptions: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          main_rate_index: number;
          monthly_expense_usd: number | null;
          monthly_income_usd: number | null;
          monthly_net_usd: number | null;
          return_rates: number[];
          start_month: string;
          start_usd: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          main_rate_index?: number;
          monthly_expense_usd?: number | null;
          monthly_income_usd?: number | null;
          monthly_net_usd?: number | null;
          return_rates?: number[];
          start_month: string;
          start_usd: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          main_rate_index?: number;
          monthly_expense_usd?: number | null;
          monthly_income_usd?: number | null;
          monthly_net_usd?: number | null;
          return_rates?: number[];
          start_month?: string;
          start_usd?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          deleted_at: string | null;
          endpoint: string;
          id: string;
          month_end_enabled: boolean;
          month_end_time: string;
          p256dh: string;
          training_days: number[];
          training_enabled: boolean;
          training_time: string;
          tz: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          auth: string;
          created_at?: string;
          deleted_at?: string | null;
          endpoint: string;
          id: string;
          month_end_enabled?: boolean;
          month_end_time?: string;
          p256dh: string;
          training_days?: number[];
          training_enabled?: boolean;
          training_time?: string;
          tz: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          deleted_at?: string | null;
          endpoint?: string;
          id?: string;
          month_end_enabled?: boolean;
          month_end_time?: string;
          p256dh?: string;
          training_days?: number[];
          training_enabled?: boolean;
          training_time?: string;
          tz?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      quote_cache: {
        Row: {
          as_of: string;
          price: number;
          symbol: string;
        };
        ComputedFields: never;
        Insert: {
          as_of: string;
          price: number;
          symbol: string;
        };
        Update: {
          as_of?: string;
          price?: number;
          symbol?: string;
        };
        Relationships: [];
      };
      reminder_deliveries: {
        Row: {
          id: string;
          kind: string;
          local_day: string;
          sent_at: string;
          subscription_id: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          kind: string;
          local_day: string;
          sent_at?: string;
          subscription_id: string;
        };
        Update: {
          id?: string;
          kind?: string;
          local_day?: string;
          sent_at?: string;
          subscription_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_deliveries_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "push_subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      study_records: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          duration_minutes: number;
          id: string;
          local_day: string;
          note: string | null;
          recorded_at: string;
          topic: string;
          tz: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          duration_minutes: number;
          id: string;
          local_day: string;
          note?: string | null;
          recorded_at: string;
          topic: string;
          tz: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          duration_minutes?: number;
          id?: string;
          local_day?: string;
          note?: string | null;
          recorded_at?: string;
          topic?: string;
          tz?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      training_sets: {
        Row: {
          band_level: string | null;
          created_at: string;
          deleted_at: string | null;
          exercise: string;
          id: string;
          local_day: string;
          recorded_at: string;
          reps: number;
          tz: string;
          updated_at: string;
          user_id: string;
          weight_kg: number | null;
        };
        ComputedFields: never;
        Insert: {
          band_level?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          exercise: string;
          id: string;
          local_day: string;
          recorded_at: string;
          reps: number;
          tz: string;
          updated_at?: string;
          user_id: string;
          weight_kg?: number | null;
        };
        Update: {
          band_level?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          exercise?: string;
          id?: string;
          local_day?: string;
          recorded_at?: string;
          reps?: number;
          tz?: string;
          updated_at?: string;
          user_id?: string;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      weight_records: {
        Row: {
          deleted_at: string | null;
          id: string;
          local_day: string;
          recorded_at: string;
          tz: string;
          updated_at: string;
          user_id: string;
          weight_kg: number;
        };
        ComputedFields: never;
        Insert: {
          deleted_at?: string | null;
          id: string;
          local_day: string;
          recorded_at: string;
          tz: string;
          updated_at?: string;
          user_id: string;
          weight_kg: number;
        };
        Update: {
          deleted_at?: string | null;
          id?: string;
          local_day?: string;
          recorded_at?: string;
          tz?: string;
          updated_at?: string;
          user_id?: string;
          weight_kg?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      timeline: {
        Row: {
          id: string | null;
          kind: string | null;
          local_day: string | null;
          occurred_at: string | null;
          payload: Json | null;
          ref_id: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
