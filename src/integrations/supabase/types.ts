export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      account_deletion_feedback: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      assignments: {
        Row: {
          attachment_files: Json
          created_at: string
          deliverable: string | null
          description: string | null
          id: string
          lesson_id: string
          objective: string | null
          task: string | null
          title: string
        }
        Insert: {
          attachment_files?: Json
          created_at?: string
          deliverable?: string | null
          description?: string | null
          id?: string
          lesson_id: string
          objective?: string | null
          task?: string | null
          title: string
        }
        Update: {
          attachment_files?: Json
          created_at?: string
          deliverable?: string | null
          description?: string | null
          id?: string
          lesson_id?: string
          objective?: string | null
          task?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_modules_with_lessons"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons_public"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          category: string
          content: string | null
          created_at: string
          emoji: string
          excerpt: string
          external_url: string | null
          id: string
          is_published: boolean
          published_at: string
          read_time: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string | null
          created_at?: string
          emoji?: string
          excerpt: string
          external_url?: string | null
          id?: string
          is_published?: boolean
          published_at?: string
          read_time?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string
          emoji?: string
          excerpt?: string
          external_url?: string | null
          id?: string
          is_published?: boolean
          published_at?: string
          read_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          certificate_link: string | null
          course_id: string
          created_at: string
          id: string
          issued_date: string | null
          status: Database["public"]["Enums"]["certificate_status"]
          student_id: string
        }
        Insert: {
          certificate_link?: string | null
          course_id: string
          created_at?: string
          id?: string
          issued_date?: string | null
          status?: Database["public"]["Enums"]["certificate_status"]
          student_id: string
        }
        Update: {
          certificate_link?: string | null
          course_id?: string
          created_at?: string
          id?: string
          issued_date?: string | null
          status?: Database["public"]["Enums"]["certificate_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      community_post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      community_posts: {
        Row: {
          author_id: string | null
          category: string | null
          content: string | null
          content_type: string | null
          created_at: string
          description: string | null
          id: string
          media_urls: Json
          metadata: Json | null
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          author_id?: string | null
          category?: string | null
          content?: string | null
          content_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          media_urls?: Json
          metadata?: Json | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          author_id?: string | null
          category?: string | null
          content?: string | null
          content_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          media_urls?: Json
          metadata?: Json | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      conversation_members: {
        Row: {
          conversation_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      course_purchases: {
        Row: {
          amount: number
          course_id: string
          id: string
          purchased_at: string
          reference: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          course_id: string
          id?: string
          purchased_at?: string
          reference?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          course_id?: string
          id?: string
          purchased_at?: string
          reference?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_purchases_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_reviews: {
        Row: {
          content: string | null
          course_id: string
          created_at: string
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          course_id: string
          created_at?: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          course_id?: string
          created_at?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          approval_mode: string
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          instructor_bio: string | null
          instructor_name: string | null
          instructor_photo_url: string | null
          is_published: boolean
          long_description: string | null
          price: number
          title: string
          trailer_video_type: string | null
          trailer_video_url: string | null
          updated_at: string
          what_you_achieve: Json | null
          who_is_for: Json | null
        }
        Insert: {
          approval_mode?: string
          category: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          instructor_bio?: string | null
          instructor_name?: string | null
          instructor_photo_url?: string | null
          is_published?: boolean
          long_description?: string | null
          price?: number
          title: string
          trailer_video_type?: string | null
          trailer_video_url?: string | null
          updated_at?: string
          what_you_achieve?: Json | null
          who_is_for?: Json | null
        }
        Update: {
          approval_mode?: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          instructor_bio?: string | null
          instructor_name?: string | null
          instructor_photo_url?: string | null
          is_published?: boolean
          long_description?: string | null
          price?: number
          title?: string
          trailer_video_type?: string | null
          trailer_video_url?: string | null
          updated_at?: string
          what_you_achieve?: Json | null
          who_is_for?: Json | null
        }
        Relationships: []
      }
      discussion_groups: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["group_status"]
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["group_status"]
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["group_status"]
        }
        Relationships: []
      }
      employer_shortlists: {
        Row: {
          created_at: string
          employer_user_id: string
          id: string
          note: string | null
          student_user_id: string
        }
        Insert: {
          created_at?: string
          employer_user_id: string
          id?: string
          note?: string | null
          student_user_id: string
        }
        Update: {
          created_at?: string
          employer_user_id?: string
          id?: string
          note?: string | null
          student_user_id?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          id: string
          progress: number
          user_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          id?: string
          progress?: number
          user_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          id?: string
          progress?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      followup_log: {
        Row: {
          id: string
          nudge_key: string
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          nudge_key: string
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          nudge_key?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "discussion_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          content: string
          created_at: string
          file_url: string | null
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          file_url?: string | null
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          file_url?: string | null
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "discussion_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_completions: {
        Row: {
          completed_at: string
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_completions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_modules_with_lessons"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "lesson_completions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_completions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed: boolean | null
          created_at: string | null
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          content_text: string | null
          content_type: string
          created_at: string
          day_number: number | null
          file_url: string | null
          file_url_backup: string | null
          id: string
          module_id: string
          order_index: number | null
          sort_order: number
          title: string
          week_number: number | null
        }
        Insert: {
          content_text?: string | null
          content_type: string
          created_at?: string
          day_number?: number | null
          file_url?: string | null
          file_url_backup?: string | null
          id?: string
          module_id: string
          order_index?: number | null
          sort_order?: number
          title: string
          week_number?: number | null
        }
        Update: {
          content_text?: string | null
          content_type?: string
          created_at?: string
          day_number?: number | null
          file_url?: string | null
          file_url_backup?: string | null
          id?: string
          module_id?: string
          order_index?: number | null
          sort_order?: number
          title?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules_with_lessons"
            referencedColumns: ["module_id"]
          },
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules_public"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_applications: {
        Row: {
          cover_message: string | null
          created_at: string
          employer_rating: number | null
          id: string
          opportunity_id: string
          proposal: string | null
          status: string
          student_user_id: string
          updated_at: string
        }
        Insert: {
          cover_message?: string | null
          created_at?: string
          employer_rating?: number | null
          id?: string
          opportunity_id: string
          proposal?: string | null
          status?: string
          student_user_id: string
          updated_at?: string
        }
        Update: {
          cover_message?: string | null
          created_at?: string
          employer_rating?: number | null
          id?: string
          opportunity_id?: string
          proposal?: string | null
          status?: string
          student_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_employer_profiles: {
        Row: {
          company_name: string
          created_at: string
          description: string | null
          featured: boolean
          id: string
          logo_url: string | null
          updated_at: string
          user_id: string
          verified: boolean
          website: string | null
        }
        Insert: {
          company_name: string
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          logo_url?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean
          website?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          logo_url?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean
          website?: string | null
        }
        Relationships: []
      }
      marketplace_opportunities: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          category: string | null
          created_at: string
          currency: string
          description: string
          employer_user_id: string
          experience_level: string
          featured: boolean
          id: string
          location_type: string
          opportunity_type: string
          required_skills: string[]
          status: string
          title: string
          updated_at: string
          views_count: number
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          created_at?: string
          currency?: string
          description: string
          employer_user_id: string
          experience_level?: string
          featured?: boolean
          id?: string
          location_type?: string
          opportunity_type?: string
          required_skills?: string[]
          status?: string
          title: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          created_at?: string
          currency?: string
          description?: string
          employer_user_id?: string
          experience_level?: string
          featured?: boolean
          id?: string
          location_type?: string
          opportunity_type?: string
          required_skills?: string[]
          status?: string
          title?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: []
      }
      marketplace_profile_views: {
        Row: {
          created_at: string
          id: string
          profile_user_id: string
          viewer_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          profile_user_id: string
          viewer_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          profile_user_id?: string
          viewer_user_id?: string | null
        }
        Relationships: []
      }
      marketplace_projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          media_urls: string[]
          student_user_id: string
          title: string
          tools_used: string[]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          media_urls?: string[]
          student_user_id: string
          title: string
          tools_used?: string[]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          media_urls?: string[]
          student_user_id?: string
          title?: string
          tools_used?: string[]
        }
        Relationships: []
      }
      marketplace_saved_opportunities: {
        Row: {
          created_at: string
          id: string
          opportunity_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          opportunity_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          opportunity_id?: string
          user_id?: string
        }
        Relationships: []
      }
      marketplace_student_profiles: {
        Row: {
          availability_status: string
          bio: string | null
          certificates: string[]
          completed_courses: string[]
          created_at: string
          earnings_total: number
          featured: boolean
          headline: string | null
          id: string
          profile_views: number
          rank_title: string
          skills: string[]
          social_links: Json
          updated_at: string
          user_id: string
          whatsapp_number: string | null
          xp_points: number
        }
        Insert: {
          availability_status?: string
          bio?: string | null
          certificates?: string[]
          completed_courses?: string[]
          created_at?: string
          earnings_total?: number
          featured?: boolean
          headline?: string | null
          id?: string
          profile_views?: number
          rank_title?: string
          skills?: string[]
          social_links?: Json
          updated_at?: string
          user_id: string
          whatsapp_number?: string | null
          xp_points?: number
        }
        Update: {
          availability_status?: string
          bio?: string | null
          certificates?: string[]
          completed_courses?: string[]
          created_at?: string
          earnings_total?: number
          featured?: boolean
          headline?: string | null
          id?: string
          profile_views?: number
          rank_title?: string
          skills?: string[]
          social_links?: Json
          updated_at?: string
          user_id?: string
          whatsapp_number?: string | null
          xp_points?: number
        }
        Relationships: []
      }
      message_attachments: {
        Row: {
          created_at: string
          id: string
          message_id: string | null
          mime: string | null
          size: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id?: string | null
          mime?: string | null
          size?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string | null
          mime?: string | null
          size?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          content_type: string | null
          conversation_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          read_by: string[]
          sender_id: string
        }
        Insert: {
          content?: string | null
          content_type?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read_by?: string[]
          sender_id: string
        }
        Update: {
          content?: string | null
          content_type?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read_by?: string[]
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string
          created_at: string
          id: string
          order_index: number | null
          sort_order: number
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          order_index?: number | null
          sort_order?: number
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          order_index?: number | null
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          event_type: string
          id: string
          is_read: boolean
          message: string | null
          metadata: Json
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      post_attachments: {
        Row: {
          created_at: string
          id: string
          mime: string | null
          post_id: string | null
          size: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime?: string | null
          post_id?: string | null
          size?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          mime?: string | null
          post_id?: string | null
          size?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_attachments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string
          content: string | null
          created_at: string
          id: string
          post_id: string | null
        }
        Insert: {
          author_id: string
          content?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
        }
        Update: {
          author_id?: string
          content?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      private_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          is_banned: boolean
          is_premium: boolean
          phone: string | null
          subscription_status: string
          trial_course_id: string | null
          trial_start_date: string
          updated_at: string
          user_id: string
          whatsapp_number: string | null
          whatsapp_opted_in: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_banned?: boolean
          is_premium?: boolean
          phone?: string | null
          subscription_status?: string
          trial_course_id?: string | null
          trial_start_date?: string
          updated_at?: string
          user_id: string
          whatsapp_number?: string | null
          whatsapp_opted_in?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_banned?: boolean
          is_premium?: boolean
          phone?: string | null
          subscription_status?: string
          trial_course_id?: string | null
          trial_start_date?: string
          updated_at?: string
          user_id?: string
          whatsapp_number?: string | null
          whatsapp_opted_in?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_trial_course_id_fkey"
            columns: ["trial_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      project_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_likes: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_likes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          admin_feedback: string | null
          course_id: string
          created_at: string
          description: string | null
          id: string
          project_files: Json | null
          public_visibility: boolean
          status: Database["public"]["Enums"]["project_status"]
          student_id: string
          title: string
        }
        Insert: {
          admin_feedback?: string | null
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          project_files?: Json | null
          public_visibility?: boolean
          status?: Database["public"]["Enums"]["project_status"]
          student_id: string
          title: string
        }
        Update: {
          admin_feedback?: string | null
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          project_files?: Json | null
          public_visibility?: boolean
          status?: Database["public"]["Enums"]["project_status"]
          student_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          course_id: string | null
          created_at: string
          discount_percent: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          uses: number
        }
        Insert: {
          code: string
          course_id?: string | null
          created_at?: string
          discount_percent: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          uses?: number
        }
        Update: {
          code?: string
          course_id?: string | null
          created_at?: string
          discount_percent?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          uses?: number
        }
        Relationships: []
      }
      site_feedback: {
        Row: {
          category: string | null
          created_at: string | null
          email: string | null
          id: string
          is_read: boolean | null
          message: string
          name: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          name?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          name?: string | null
        }
        Relationships: []
      }
      submissions: {
        Row: {
          assignment_id: string
          feedback: string | null
          file_url: string | null
          id: string
          status: string
          submission_files: Json | null
          submitted_at: string
          text_submission: string | null
          user_id: string
        }
        Insert: {
          assignment_id: string
          feedback?: string | null
          file_url?: string | null
          id?: string
          status?: string
          submission_files?: Json | null
          submitted_at?: string
          text_submission?: string | null
          user_id: string
        }
        Update: {
          assignment_id?: string
          feedback?: string | null
          file_url?: string | null
          id?: string
          status?: string
          submission_files?: Json | null
          submitted_at?: string
          text_submission?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_published: boolean | null
          name: string
          rating: number | null
          role: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          name: string
          rating?: number | null
          role?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          name?: string
          rating?: number | null
          role?: string | null
        }
        Relationships: []
      }
      user_follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
          id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
          id?: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
          id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          last_active: string
          online: boolean
          user_id: string
        }
        Insert: {
          last_active?: string
          online?: boolean
          user_id: string
        }
        Update: {
          last_active?: string
          online?: boolean
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_lessons: {
        Row: {
          bucket_name: string | null
          created_at: string | null
          description: string | null
          id: string
          title: string
          video_path: string
        }
        Insert: {
          bucket_name?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          title: string
          video_path: string
        }
        Update: {
          bucket_name?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          title?: string
          video_path?: string
        }
        Relationships: []
      }
      whatsapp_message_log: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          notification_id: string | null
          phone_number: string
          status: string
          template_name: string
          user_id: string
          wamid: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          notification_id?: string | null
          phone_number: string
          status?: string
          template_name: string
          user_id: string
          wamid?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          notification_id?: string | null
          phone_number?: string
          status?: string
          template_name?: string
          user_id?: string
          wamid?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      course_modules_with_lessons: {
        Row: {
          lesson_id: string | null
          lesson_title: string | null
          module_id: string | null
          module_title: string | null
        }
        Relationships: []
      }
      lessons_public: {
        Row: {
          content_type: string | null
          created_at: string | null
          day_number: number | null
          id: string | null
          module_id: string | null
          order_index: number | null
          sort_order: number | null
          title: string | null
          week_number: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules_with_lessons"
            referencedColumns: ["module_id"]
          },
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules_public"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_student_profiles_public: {
        Row: {
          availability_status: string | null
          bio: string | null
          certificates: string[] | null
          completed_courses: string[] | null
          created_at: string | null
          featured: boolean | null
          headline: string | null
          profile_views: number | null
          rank_title: string | null
          skills: string[] | null
          social_links: Json | null
          updated_at: string | null
          user_id: string | null
          xp_points: number | null
        }
        Insert: {
          availability_status?: string | null
          bio?: string | null
          certificates?: string[] | null
          completed_courses?: string[] | null
          created_at?: string | null
          featured?: boolean | null
          headline?: string | null
          profile_views?: number | null
          rank_title?: string | null
          skills?: string[] | null
          social_links?: Json | null
          updated_at?: string | null
          user_id?: string | null
          xp_points?: number | null
        }
        Update: {
          availability_status?: string | null
          bio?: string | null
          certificates?: string[] | null
          completed_courses?: string[] | null
          created_at?: string | null
          featured?: boolean | null
          headline?: string | null
          profile_views?: number | null
          rank_title?: string | null
          skills?: string[] | null
          social_links?: Json | null
          updated_at?: string | null
          user_id?: string | null
          xp_points?: number | null
        }
        Relationships: []
      }
      modules_public: {
        Row: {
          course_id: string | null
          created_at: string | null
          id: string | null
          order_index: number | null
          sort_order: number | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_read_to_message: {
        Args: { message_id: string; user_id: string }
        Returns: undefined
      }
      can_access_course: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: boolean
      }
      can_access_lesson: {
        Args: { p_lesson_id: string; p_user_id: string }
        Returns: boolean
      }
      fetch_trending_posts: {
        Args: { p_limit: number }
        Returns: {
          author_id: string
          comments_count: number
          content: string
          content_type: string
          created_at: string
          id: string
          likes_count: number
          metadata: Json
          title: string
          updated_at: string
        }[]
      }
      get_employer_analytics: { Args: { emp_user_id: string }; Returns: Json }
      get_my_profile: {
        Args: never
        Returns: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          is_banned: boolean
          is_premium: boolean
          phone: string | null
          subscription_status: string
          trial_course_id: string | null
          trial_start_date: string
          updated_at: string
          user_id: string
          whatsapp_number: string | null
          whatsapp_opted_in: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_next_lesson: {
        Args: { p_current_lesson: string; p_user_id: string }
        Returns: {
          next_lesson_id: string
        }[]
      }
      get_platform_stats: { Args: never; Returns: Json }
      get_posts_for_user: {
        Args: { p_limit: number; p_user_id: string }
        Returns: {
          author_followed: boolean
          author_id: string
          comments_count: number
          content: string
          content_type: string
          created_at: string
          id: string
          liked_by_me: boolean
          likes_count: number
          metadata: Json
          title: string
          updated_at: string
        }[]
      }
      has_course_access: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_opportunity_views: {
        Args: { opp_id: string }
        Returns: undefined
      }
      is_lesson_assignment_approved: {
        Args: { p_lesson_id: string; p_user_id: string }
        Returns: boolean
      }
      resend_whatsapp_notification: {
        Args: { p_notification_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user" | "employer"
      certificate_status: "Pending" | "Issued"
      group_status: "active" | "suspended"
      notification_event_type:
        | "new_message"
        | "new_assignment"
        | "assignment_due_date_reminder"
        | "assignment_review_complete"
        | "course_content_updated"
        | "new_announcement"
        | "application_update"
        | "shortlisted"
        | "hired"
        | "new_opportunity"
        | "profile_view"
        | "lesson_unlocked"
        | "certificate_earned"
        | "trial_expiry"
        | "payment_confirmed"
        | "announcement"
      project_status: "Draft" | "Submitted" | "Approved" | "Rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "employer"],
      certificate_status: ["Pending", "Issued"],
      group_status: ["active", "suspended"],
      notification_event_type: [
        "new_message",
        "new_assignment",
        "assignment_due_date_reminder",
        "assignment_review_complete",
        "course_content_updated",
        "new_announcement",
        "application_update",
        "shortlisted",
        "hired",
        "new_opportunity",
        "profile_view",
        "lesson_unlocked",
        "certificate_earned",
        "trial_expiry",
        "payment_confirmed",
        "announcement",
      ],
      project_status: ["Draft", "Submitted", "Approved", "Rejected"],
    },
  },
} as const
