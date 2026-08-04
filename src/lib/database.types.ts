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
export type CampaignUsageScope = "organico" | "pauta" | "todo_medio";
export type CampaignUsageDuration = "meses_3" | "meses_6" | "meses_12" | "perpetuo";
export type ApplicationStatus =
  | "pending"
  | "reviewing"
  | "accepted"
  | "rejected"
  | "delivered"
  | "approved"
  | "cancelled"
  | "disputed";
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
// Nota: no hay enum de etapas. Las columnas del pipeline —tanto el del admin
// (`content_columns`) como el del creador (`creator_task_columns`)— son filas
// configurables, porque un enum de Postgres no se puede extender en runtime.
// Lo que antes se preguntaba por nombre ("¿es 'publicado'?") ahora se pregunta
// por significado: las banderas is_done / is_pending_approval.
export type ContentApproval = "pendiente" | "correccion" | "revisado";
export type ContentPriority = "baja" | "media" | "alta";
export type ContentPlatform = "instagram" | "tiktok" | "reels";

// Nota: el tablero del creador NO tiene enum de etapas. Sus columnas son filas
// de `creator_task_columns` para que cada creador arme las suyas — un enum de
// Postgres no se puede extender en runtime. Ver 20260727100000.
/** Pestaña del tablero. Ver la migración 20260803100000. */
export type PipelineSection = "guion" | "video";
export type CalendarEventType = "publicacion" | "grabacion" | "reunion" | "entrega" | "guion";
export type CalendarEventStatus = "programado" | "hecho" | "pausado";
export type CalendarMonthStatus = "pendiente" | "aprobado";
export type WaDirection = "out" | "in";
export type WaMessageStatus = "queued" | "sent" | "failed" | "received";
export type WaActionKind =
  | "mover_pieza"
  | "marcar_hecho"
  | "reprogramar"
  // Crear tiene dos destinos: un video va al tablero, una jornada de grabación
  // al calendario. Las filas viejas conservan 'crear_pieza' aunque hayan sido
  // grabaciones — ver 20260802400000.
  | "crear_pieza"
  | "crear_evento";
export type WaActionStatus =
  | "propuesta"
  | "ejecutada"
  | "descartada"
  | "vencida"
  | "reemplazada"
  | "fallida";

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
          logo_url: string | null;
          location: string | null;
          verified: boolean;
          slug: string | null;
        };
        Insert: {
          profile_id: string;
          brand_name: string;
          industry?: string | null;
          website?: string | null;
          instagram_handle?: string | null;
          description?: string | null;
          logo_url?: string | null;
          location?: string | null;
          verified?: boolean;
          slug?: string | null;
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
          compensation_details: string | null;
          usage_rights_scope: CampaignUsageScope | null;
          usage_rights_duration: CampaignUsageDuration | null;
          usage_rights_editing: boolean | null;
          usage_rights_notes: string | null;
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
          compensation_details?: string | null;
          usage_rights_scope?: CampaignUsageScope | null;
          usage_rights_duration?: CampaignUsageDuration | null;
          usage_rights_editing?: boolean | null;
          usage_rights_notes?: string | null;
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
          rating: number | null;
          conflict_reason: string | null;
          conflict_by: string | null;
          conflict_at: string | null;
          admin_note: string | null;
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
          rating?: number | null;
          conflict_reason?: string | null;
          conflict_by?: string | null;
          conflict_at?: string | null;
          admin_note?: string | null;
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
          views: number | null;
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
          views?: number | null;
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
          phone_e164: string | null;
          wa_opt_in: boolean;
          wa_opt_in_at: string | null;
          reminder_hour: number;
          created_at: string;
        };
        Insert: {
          profile_id: string;
          staff_role: StaffRole;
          color?: string;
          active?: boolean;
          phone_e164?: string | null;
          wa_opt_in?: boolean;
          wa_opt_in_at?: string | null;
          reminder_hour?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff_members"]["Insert"]>;
        Relationships: [];
      };
      wa_messages: {
        Row: {
          id: string;
          profile_id: string;
          direction: WaDirection;
          body: string;
          template_name: string | null;
          provider_sid: string | null;
          status: WaMessageStatus;
          error: string | null;
          dedupe_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          direction: WaDirection;
          body: string;
          template_name?: string | null;
          provider_sid?: string | null;
          status?: WaMessageStatus;
          error?: string | null;
          dedupe_key?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["wa_messages"]["Insert"]>;
        Relationships: [];
      };
      agent_settings: {
        Row: {
          id: boolean;
          nombre: string;
          // Vacío = usar PERSONA_SEED de src/lib/ugc/agente.ts. Ver la
          // migración 20260802000000.
          persona: string;
          instrucciones: string;
          // Vacío = no contestarle a nadie de afuera, aunque el switch esté
          // prendido. Ver la migración 20260802100000.
          responder_desconocidos: boolean;
          sobre_qlabs: string;
          guion_publico: string;
          /** Vacío o una URL https. Ver el check de la migración 20260802100000. */
          link_agenda: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: boolean;
          nombre?: string;
          persona?: string;
          instrucciones?: string;
          responder_desconocidos?: boolean;
          sobre_qlabs?: string;
          guion_publico?: string;
          link_agenda?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["agent_settings"]["Insert"]>;
        Relationships: [];
      };
      wa_agent_actions: {
        Row: {
          id: string;
          profile_id: string;
          kind: WaActionKind;
          payload: Record<string, unknown>;
          status: WaActionStatus;
          target_table: string | null;
          target_id: string | null;
          error: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          kind: WaActionKind;
          payload: Record<string, unknown>;
          status: WaActionStatus;
          target_table?: string | null;
          target_id?: string | null;
          error?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["wa_agent_actions"]["Insert"]>;
        Relationships: [];
      };
      wa_public_messages: {
        Row: {
          id: string;
          phone_e164: string;
          direction: WaDirection;
          body: string;
          provider_sid: string | null;
          status: WaMessageStatus;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          phone_e164: string;
          direction: WaDirection;
          body: string;
          provider_sid?: string | null;
          status?: WaMessageStatus;
          error?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["wa_public_messages"]["Insert"]>;
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
          monthly_target: number | null;
          /** Fuera de servicio: ver la migración 20260803110000. */
          archived: boolean;
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
          monthly_target?: number | null;
          archived?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["agency_clients"]["Insert"]>;
        Relationships: [];
      };
      content_columns: {
        Row: {
          id: string;
          name: string;
          color: string;
          position: number;
          sop_code: string | null;
          owner_role: string | null;
          is_done: boolean;
          is_pending_approval: boolean;
          /** La pieza ya está hecha y solo espera la fecha. Migración 20260803120000. */
          is_ready: boolean;
          section: PipelineSection;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string;
          position?: number;
          sop_code?: string | null;
          owner_role?: string | null;
          is_done?: boolean;
          is_pending_approval?: boolean;
          is_ready?: boolean;
          section?: PipelineSection;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_columns"]["Insert"]>;
        Relationships: [];
      };
      content_pieces: {
        Row: {
          id: string;
          brand_id: string;
          title: string;
          code: string | null;
          column_id: string;
          approval: ContentApproval;
          owner_id: string | null;
          priority: ContentPriority;
          platform: ContentPlatform;
          // Columnas `date`, no timestamptz: llegan como 'yyyy-MM-dd' sin hora
          // ni zona. Ver la migración 20260801000000 — pasarlas por `new Date()`
          // y compararlas como instantes es exactamente el bug que arregló.
          publish_date: string | null;
          record_date: string | null;
          drive_url: string | null;
          script_url: string | null;
          final_url: string | null;
          notes: string | null;
          // La cargó McLovin desde el chat de WhatsApp, no una persona desde el
          // tablero. Ver la migración 20260802000000.
          created_by_agent: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          title: string;
          code?: string | null;
          column_id: string;
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
          created_by_agent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_pieces"]["Insert"]>;
        Relationships: [];
      };
      creator_transcriptions: {
        Row: {
          id: string;
          creator_id: string;
          source_url: string | null;
          source_type: string;
          file_name: string | null;
          title: string | null;
          status: "pending" | "processing" | "done" | "error";
          segments: { timestamp: string; text: string }[] | null;
          error_message: string | null;
          improved_script: string | null;
          improved_script_at: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          creator_id: string;
          source_url?: string | null;
          source_type?: string;
          file_name?: string | null;
          title?: string | null;
          status?: "pending" | "processing" | "done" | "error";
          segments?: { timestamp: string; text: string }[] | null;
          error_message?: string | null;
          improved_script?: string | null;
          improved_script_at?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["creator_transcriptions"]["Insert"]>;
        Relationships: [];
      };
      creator_task_columns: {
        Row: {
          id: string;
          creator_id: string;
          name: string;
          color: string;
          position: number;
          is_done: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          name: string;
          color?: string;
          position?: number;
          is_done?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["creator_task_columns"]["Insert"]>;
        Relationships: [];
      };
      creator_tasks: {
        Row: {
          id: string;
          creator_id: string;
          title: string;
          column_id: string;
          notes: string | null;
          platform: ContentPlatform | null;
          due_date: string | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          title: string;
          column_id: string;
          notes?: string | null;
          platform?: ContentPlatform | null;
          due_date?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["creator_tasks"]["Insert"]>;
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
          created_by_agent: boolean;
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
          created_by_agent?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["calendar_events"]["Insert"]>;
        Relationships: [];
      };
      hero_calendar_months: {
        Row: {
          hero_id: string;
          month: string;
          status: CalendarMonthStatus;
          approved_at: string | null;
        };
        Insert: {
          hero_id: string;
          month: string;
          status?: CalendarMonthStatus;
          approved_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["hero_calendar_months"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      creator_public_profiles: {
        Row: {
          profile_id: string;
          handle: string;
          followers_count: number;
          niches: string[];
          languages: string[];
          instagram_handle: string | null;
          tiktok_handle: string | null;
          verified: boolean;
          engagement_rate: number | null;
          avg_views: number | null;
          display_name: string | null;
          bio: string | null;
          city: string | null;
          avatar_url: string | null;
        };
        Relationships: [];
      };
      campaign_previews: {
        Row: {
          id: string;
          title: string;
          brand_name: string;
          industry: string | null;
          brand_logo_url: string | null;
          brand_location: string | null;
          brand_slug: string | null;
          brand_verified: boolean;
          deliverable_types: string[] | null;
          published_at: string | null;
        };
        Relationships: [];
      };
      // staff_members sin los datos de contacto. La lee cualquiera del equipo;
      // la tabla de atrás es solo de directores.
      staff_directory: {
        Row: {
          profile_id: string;
          staff_role: StaffRole;
          color: string;
          active: boolean;
        };
        Relationships: [];
      };
    };
    Functions: {
      current_app_role: {
        Args: Record<string, never>;
        Returns: AppRole | null;
      };
      is_director: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      public_marketplace_stats: {
        Args: Record<string, never>;
        Returns: {
          published_campaigns_count: number;
          creators_count: number;
          verified_creators_count: number;
          brands_count: number;
        }[];
      };
      brand_public_campaigns: {
        Args: { p_slug: string };
        Returns: {
          id: string;
          title: string;
          deliverable_types: string[] | null;
          published_at: string | null;
        }[];
      };
      creator_delivery_stats: {
        Args: { p_creator_id: string };
        Returns: {
          approved_count: number;
          on_time_ratio: number | null;
        }[];
      };
      creator_public_stats: {
        Args: { p_creator_id: string };
        Returns: {
          approved_count: number;
          delivered_count: number;
          on_time_ratio: number | null;
          avg_rating: number | null;
          rating_count: number;
        }[];
      };
    };
    Enums: {
      app_role: AppRole;
      campaign_status: CampaignStatus;
      campaign_usage_scope: CampaignUsageScope;
      campaign_usage_duration: CampaignUsageDuration;
      application_status: ApplicationStatus;
      staff_role: StaffRole;
      content_approval: ContentApproval;
      content_priority: ContentPriority;
      content_platform: ContentPlatform;
      calendar_event_type: CalendarEventType;
      calendar_event_status: CalendarEventStatus;
      calendar_month_status: CalendarMonthStatus;
    };
  };
}
