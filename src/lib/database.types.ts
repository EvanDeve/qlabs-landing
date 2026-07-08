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
export type PortfolioMediaType = "image" | "video";
export type HeroContact = { name: string; role?: string; phone?: string; email?: string };
export type StaffRole =
  | "director"
  | "pm"
  | "estratega"
  | "guionista"
  | "productor"
  | "editor"
  | "qa"
  | "community"
  | "ventas";
export type ContentStage =
  | "pendiente"
  | "estrategia"
  | "guion"
  | "aprobacion_guion"
  | "grabacion"
  | "edicion"
  | "qa"
  | "revision_cliente"
  | "programado"
  | "publicado";
export type ContentApproval = "pendiente" | "correccion" | "revisado";
export type ContentPriority = "baja" | "media" | "alta";
export type ContentPlatform = "instagram" | "tiktok" | "reels";
export type CalendarEventType = "publicacion" | "grabacion" | "reunion" | "entrega";
export type CalendarEventStatus = "programado" | "hecho" | "pausado";

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
          avg_views: number | null;
          engagement_rate: number | null;
          avg_reach: number | null;
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
          avg_views?: number | null;
          engagement_rate?: number | null;
          avg_reach?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["creator_profiles"]["Insert"]>;
        Relationships: [];
      };
      creator_skills: {
        Row: {
          id: string;
          creator_id: string;
          name: string;
          level: number;
          position: number;
        };
        Insert: {
          id?: string;
          creator_id: string;
          name: string;
          level: number;
          position?: number;
        };
        Update: Partial<Database["public"]["Tables"]["creator_skills"]["Insert"]>;
        Relationships: [];
      };
      creator_services: {
        Row: {
          id: string;
          creator_id: string;
          service: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          service: string;
        };
        Update: Partial<Database["public"]["Tables"]["creator_services"]["Insert"]>;
        Relationships: [];
      };
      creator_addons: {
        Row: {
          id: string;
          creator_id: string;
          addon: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          addon: string;
        };
        Update: Partial<Database["public"]["Tables"]["creator_addons"]["Insert"]>;
        Relationships: [];
      };
      creator_past_brands: {
        Row: {
          id: string;
          creator_id: string;
          category: string;
          brand_name: string;
          position: number;
        };
        Insert: {
          id?: string;
          creator_id: string;
          category: string;
          brand_name: string;
          position?: number;
        };
        Update: Partial<Database["public"]["Tables"]["creator_past_brands"]["Insert"]>;
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
          accepted_at: string | null;
          delivered_at: string | null;
          approved_at: string | null;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          creator_id: string;
          pitch_message?: string | null;
          status?: ApplicationStatus;
          created_at?: string;
          status_changed_at?: string;
          accepted_at?: string | null;
          delivered_at?: string | null;
          approved_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["applications"]["Insert"]>;
        Relationships: [];
      };
      application_deliveries: {
        Row: {
          id: string;
          application_id: string;
          creator_id: string;
          kind: "file" | "link";
          storage_path: string | null;
          external_url: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          application_id: string;
          creator_id: string;
          kind: "file" | "link";
          storage_path?: string | null;
          external_url?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["application_deliveries"]["Insert"]>;
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
      portfolio_items: {
        Row: {
          id: string;
          creator_id: string;
          storage_path: string;
          media_type: PortfolioMediaType;
          category: string;
          caption: string | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          storage_path: string;
          media_type: PortfolioMediaType;
          category?: string;
          caption?: string | null;
          position?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["portfolio_items"]["Insert"]>;
        Relationships: [];
      };
      staff_members: {
        Row: {
          profile_id: string;
          staff_role: StaffRole;
          color: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          profile_id: string;
          staff_role: StaffRole;
          color?: string;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff_members"]["Insert"]>;
        Relationships: [];
      };
      agency_clients: {
        Row: {
          id: string;
          name: string;
          industry: string | null;
          website: string | null;
          contact_email: string | null;
          logo_url: string | null;
          drive_url: string | null;
          servicios: string[];
          contacts: HeroContact[];
          client_since: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          industry?: string | null;
          website?: string | null;
          contact_email?: string | null;
          logo_url?: string | null;
          drive_url?: string | null;
          servicios?: string[];
          contacts?: HeroContact[];
          client_since?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["agency_clients"]["Insert"]>;
        Relationships: [];
      };
      content_pieces: {
        Row: {
          id: string;
          brand_id: string;
          title: string;
          code: string;
          stage: ContentStage;
          approval: ContentApproval;
          owner_id: string | null;
          priority: ContentPriority;
          platform: ContentPlatform;
          publish_date: string | null;
          record_date: string | null;
          drive_url: string | null;
          script_url: string | null;
          final_url: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          title: string;
          code: string;
          stage?: ContentStage;
          approval?: ContentApproval;
          owner_id?: string | null;
          priority?: ContentPriority;
          platform?: ContentPlatform;
          publish_date?: string | null;
          record_date?: string | null;
          drive_url?: string | null;
          script_url?: string | null;
          final_url?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_pieces"]["Insert"]>;
        Relationships: [];
      };
      calendar_events: {
        Row: {
          id: string;
          type: CalendarEventType;
          brand_id: string | null;
          content_piece_id: string | null;
          title: string;
          starts_at: string;
          responsible_id: string | null;
          status: CalendarEventStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: CalendarEventType;
          brand_id?: string | null;
          content_piece_id?: string | null;
          title: string;
          starts_at: string;
          responsible_id?: string | null;
          status?: CalendarEventStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["calendar_events"]["Insert"]>;
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
      creator_delivery_stats: {
        Args: { p_creator_id: string };
        Returns: {
          approved_count: number;
          on_time_ratio: number | null;
        }[];
      };
    };
    Enums: {
      app_role: AppRole;
      campaign_status: CampaignStatus;
      application_status: ApplicationStatus;
      staff_role: StaffRole;
      content_stage: ContentStage;
      content_approval: ContentApproval;
      content_priority: ContentPriority;
      content_platform: ContentPlatform;
      calendar_event_type: CalendarEventType;
      calendar_event_status: CalendarEventStatus;
    };
  };
}
