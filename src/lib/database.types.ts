// Hand-written to match supabase/migrations/*.sql — regenerate with
// `npm run db:types` once a local (Docker) or hosted Supabase project exists:
//   supabase gen types typescript --local > src/lib/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = "creator" | "brand" | "admin";
export type CampaignStatus = "draft" | "published" | "in_progress" | "completed" | "cancelled";
export type ApplicationStatus =
  | "pending"
  | "reviewing"
  | "accepted"
  | "rejected"
  | "delivered"
  | "approved";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: AppRole | null;
          display_name: string | null;
          avatar_url: string | null;
          city: string | null;
          bio: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          role?: AppRole | null;
          display_name?: string | null;
          avatar_url?: string | null;
          city?: string | null;
          bio?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      creator_profiles: {
        Row: {
          profile_id: string;
          handle: string;
          followers_count: number;
          niches: string[];
          languages: string[];
          instagram_handle: string | null;
          tiktok_handle: string | null;
          rate_min: number | null;
          rate_max: number | null;
          verified: boolean;
        };
        Insert: {
          profile_id: string;
          handle: string;
          followers_count?: number;
          niches?: string[];
          languages?: string[];
          instagram_handle?: string | null;
          tiktok_handle?: string | null;
          rate_min?: number | null;
          rate_max?: number | null;
          verified?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["creator_profiles"]["Insert"]>;
        Relationships: [];
      };
      brand_profiles: {
        Row: {
          profile_id: string;
          brand_name: string;
          industry: string | null;
          website: string | null;
          instagram_handle: string | null;
          description: string | null;
        };
        Insert: {
          profile_id: string;
          brand_name: string;
          industry?: string | null;
          website?: string | null;
          instagram_handle?: string | null;
          description?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["brand_profiles"]["Insert"]>;
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          brand_id: string;
          title: string;
          brief: string;
          budget_amount: number;
          budget_currency: string;
          deliverables: Json;
          target_audience: string | null;
          deadline_days: number | null;
          status: CampaignStatus;
          min_tier: string | null;
          created_at: string;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          brand_id: string;
          title: string;
          brief: string;
          budget_amount: number;
          budget_currency?: string;
          deliverables?: Json;
          target_audience?: string | null;
          deadline_days?: number | null;
          status?: CampaignStatus;
          min_tier?: string | null;
          created_at?: string;
          published_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["campaigns"]["Insert"]>;
        Relationships: [];
      };
      applications: {
        Row: {
          id: string;
          campaign_id: string;
          creator_id: string;
          pitch_message: string | null;
          status: ApplicationStatus;
          created_at: string;
          status_changed_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          creator_id: string;
          pitch_message?: string | null;
          status?: ApplicationStatus;
          created_at?: string;
          status_changed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["applications"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          profile_id: string;
          type: string;
          payload: Json;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          type: string;
          payload?: Json;
          read?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      campaign_previews: {
        Row: {
          id: string;
          title: string;
          brand_name: string;
          industry: string | null;
          deliverable_types: string[] | null;
          published_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      current_app_role: {
        Args: Record<string, never>;
        Returns: AppRole | null;
      };
      public_marketplace_stats: {
        Args: Record<string, never>;
        Returns: {
          published_campaigns_count: number;
          creators_count: number;
          brands_count: number;
        }[];
      };
    };
    Enums: {
      app_role: AppRole;
      campaign_status: CampaignStatus;
      application_status: ApplicationStatus;
    };
  };
}
