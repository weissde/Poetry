export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      poems: {
        Row: {
          id: string;
          title: string;
          author: string;
          dynasty: string;
          content: string;
          tags: string[];
          grade_level: string[];
          created_at: string;
          updated_at: string;
          curriculum_unit: string | null;
          teaching_objectives: Json;
          inquiry_tasks: Json;
          exam_points: Json;
          difficulty_level: "easy" | "medium" | "hard";
          period_estimate_minutes: number;
        };
        Insert: {
          id?: string;
          title: string;
          author: string;
          dynasty: string;
          content: string;
          tags?: string[];
          grade_level?: string[];
          created_at?: string;
          updated_at?: string;
          curriculum_unit?: string | null;
          teaching_objectives?: Json;
          inquiry_tasks?: Json;
          exam_points?: Json;
          difficulty_level?: "easy" | "medium" | "hard";
          period_estimate_minutes?: number;
        };
        Update: {
          id?: string;
          title?: string;
          author?: string;
          dynasty?: string;
          content?: string;
          tags?: string[];
          grade_level?: string[];
          created_at?: string;
          updated_at?: string;
          curriculum_unit?: string | null;
          teaching_objectives?: Json;
          inquiry_tasks?: Json;
          exam_points?: Json;
          difficulty_level?: "easy" | "medium" | "hard";
          period_estimate_minutes?: number;
        };
        Relationships: [];
      };
      analysis_cache: {
        Row: {
          id: string;
          poem_hash: string;
          poem_id: string | null;
          model: string;
          analysis_json: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          poem_hash: string;
          poem_id?: string | null;
          model: string;
          analysis_json: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          poem_hash?: string;
          poem_id?: string | null;
          model?: string;
          analysis_json?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          poem_id: string | null;
          type: string;
          difficulty: number;
          content: string;
          options: Json | null;
          answer: string;
          explanation: string | null;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          poem_id?: string | null;
          type: string;
          difficulty?: number;
          content: string;
          options?: Json | null;
          answer: string;
          explanation?: string | null;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          poem_id?: string | null;
          type?: string;
          difficulty?: number;
          content?: string;
          options?: Json | null;
          answer?: string;
          explanation?: string | null;
          source?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_answers: {
        Row: {
          id: string;
          user_id: string;
          question_id: string | null;
          poem_id: string | null;
          question_type: string | null;
          user_answer: string | null;
          is_correct: boolean | null;
          time_spent: number | null;
          context: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          question_id?: string | null;
          poem_id?: string | null;
          question_type?: string | null;
          user_answer?: string | null;
          is_correct?: boolean | null;
          time_spent?: number | null;
          context?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          question_id?: string | null;
          poem_id?: string | null;
          question_type?: string | null;
          user_answer?: string | null;
          is_correct?: boolean | null;
          time_spent?: number | null;
          context?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      wrong_questions: {
        Row: {
          id: string;
          user_id: string;
          poem_title: string | null;
          question_content: string;
          user_answer: string | null;
          correct_answer: string | null;
          explanation: string | null;
          error_type: string | null;
          status: string;
          created_at: string;
          updated_at: string;
          dynasty: string | null;
          theme: string | null;
          question_kind: string | null;
          keyword_tags: string[];
          question_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          poem_title?: string | null;
          question_content: string;
          user_answer?: string | null;
          correct_answer?: string | null;
          explanation?: string | null;
          error_type?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          dynasty?: string | null;
          theme?: string | null;
          question_kind?: string | null;
          keyword_tags?: string[];
          question_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          poem_title?: string | null;
          question_content?: string;
          user_answer?: string | null;
          correct_answer?: string | null;
          explanation?: string | null;
          error_type?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          dynasty?: string | null;
          theme?: string | null;
          question_kind?: string | null;
          keyword_tags?: string[];
          question_id?: string | null;
        };
        Relationships: [];
      };
      weakness_profiles: {
        Row: {
          id: string;
          user_id: string;
          profile_json: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          profile_json?: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          profile_json?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      exam_records: {
        Row: {
          id: string;
          user_id: string;
          exam_type: string;
          total_score: number;
          max_score: number;
          answer_detail: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exam_type: string;
          total_score?: number;
          max_score?: number;
          answer_detail?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          exam_type?: string;
          total_score?: number;
          max_score?: number;
          answer_detail?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      review_plans: {
        Row: {
          id: string;
          user_id: string;
          exam_date: string | null;
          plan_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exam_date?: string | null;
          plan_json: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          exam_date?: string | null;
          plan_json?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      creations: {
        Row: {
          id: string;
          user_id: string;
          style: string | null;
          reference_poem: string | null;
          content: string;
          feedback_json: Json | null;
          created_at: string;
          mode: string;
          source_text: string | null;
          is_public: boolean;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          style?: string | null;
          reference_poem?: string | null;
          content: string;
          feedback_json?: Json | null;
          created_at?: string;
          mode?: string;
          source_text?: string | null;
          is_public?: boolean;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          style?: string | null;
          reference_poem?: string | null;
          content?: string;
          feedback_json?: Json | null;
          created_at?: string;
          mode?: string;
          source_text?: string | null;
          is_public?: boolean;
          published_at?: string | null;
        };
        Relationships: [];
      };
      creation_likes: {
        Row: {
          id: string;
          creation_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          creation_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          creation_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          id: string;
          nickname: string | null;
          grade_level: string | null;
          avatar_url: string | null;
          streak_days: number;
          created_at: string;
          updated_at: string;
          role: "student" | "teacher";
          school_name: string | null;
          class_name: string | null;
        };
        Insert: {
          id: string;
          nickname?: string | null;
          grade_level?: string | null;
          avatar_url?: string | null;
          streak_days?: number;
          created_at?: string;
          updated_at?: string;
          role?: "student" | "teacher";
          school_name?: string | null;
          class_name?: string | null;
        };
        Update: {
          id?: string;
          nickname?: string | null;
          grade_level?: string | null;
          avatar_url?: string | null;
          streak_days?: number;
          created_at?: string;
          updated_at?: string;
          role?: "student" | "teacher";
          school_name?: string | null;
          class_name?: string | null;
        };
        Relationships: [];
      };
      memory_reviews: {
        Row: {
          id: string;
          user_id: string;
          poem_id: string;
          status: string;
          review_count: number;
          success_count: number;
          interval_days: number;
          ease_factor: number;
          due_date: string;
          last_reviewed_at: string | null;
          last_quality: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          poem_id: string;
          status?: string;
          review_count?: number;
          success_count?: number;
          interval_days?: number;
          ease_factor?: number;
          due_date?: string;
          last_reviewed_at?: string | null;
          last_quality?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          poem_id?: string;
          status?: string;
          review_count?: number;
          success_count?: number;
          interval_days?: number;
          ease_factor?: number;
          due_date?: string;
          last_reviewed_at?: string | null;
          last_quality?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      memory_review_logs: {
        Row: {
          id: string;
          user_id: string;
          memory_review_id: string;
          poem_id: string;
          quality: number;
          is_correct: boolean;
          mode: string;
          time_spent: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          memory_review_id: string;
          poem_id: string;
          quality: number;
          is_correct?: boolean;
          mode?: string;
          time_spent?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          memory_review_id?: string;
          poem_id?: string;
          quality?: number;
          is_correct?: boolean;
          mode?: string;
          time_spent?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      poem_favorites: {
        Row: {
          id: string;
          user_id: string;
          poem_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          poem_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          poem_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      poem_notes: {
        Row: {
          id: string;
          user_id: string;
          poem_id: string;
          note: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          poem_id: string;
          note?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          poem_id?: string;
          note?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      practice_session_summaries: {
        Row: {
          id: string;
          user_id: string;
          source: string;
          topic: string | null;
          summary: string;
          attempts: number;
          correct: number;
          accuracy: number;
          weak_type: string | null;
          type_stats: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source?: string;
          topic?: string | null;
          summary: string;
          attempts?: number;
          correct?: number;
          accuracy?: number;
          weak_type?: string | null;
          type_stats?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source?: string;
          topic?: string | null;
          summary?: string;
          attempts?: number;
          correct?: number;
          accuracy?: number;
          weak_type?: string | null;
          type_stats?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      practice_question_feedback: {
        Row: {
          id: string;
          user_id: string;
          topic: string | null;
          question_type: string | null;
          question_content: string;
          options_json: Json;
          selected_index: number | null;
          correct_index: number | null;
          comment: string;
          source: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic?: string | null;
          question_type?: string | null;
          question_content: string;
          options_json?: Json;
          selected_index?: number | null;
          correct_index?: number | null;
          comment: string;
          source?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          topic?: string | null;
          question_type?: string | null;
          question_content?: string;
          options_json?: Json;
          selected_index?: number | null;
          correct_index?: number | null;
          comment?: string;
          source?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      teaching_units: {
        Row: {
          id: string;
          title: string;
          subtitle: string | null;
          category: string;
          grade_level: string[];
          poem_ids: string[];
          poem_count: number;
          curriculum_ref: string | null;
          mastery_target: number;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          subtitle?: string | null;
          category?: string;
          grade_level?: string[];
          poem_ids?: string[];
          poem_count?: number;
          curriculum_ref?: string | null;
          mastery_target?: number;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          subtitle?: string | null;
          category?: string;
          grade_level?: string[];
          poem_ids?: string[];
          poem_count?: number;
          curriculum_ref?: string | null;
          mastery_target?: number;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      class_sessions: {
        Row: {
          id: string;
          teacher_id: string;
          poem_id: string | null;
          poem_title: string | null;
          poem_author: string | null;
          unit_id: string | null;
          current_step: number;
          status: "active" | "paused" | "completed";
          notes: string | null;
          duration_minutes: number | null;
          started_at: string;
          ended_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          poem_id?: string | null;
          poem_title?: string | null;
          poem_author?: string | null;
          unit_id?: string | null;
          current_step?: number;
          status?: "active" | "paused" | "completed";
          notes?: string | null;
          duration_minutes?: number | null;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          teacher_id?: string;
          poem_id?: string | null;
          poem_title?: string | null;
          poem_author?: string | null;
          unit_id?: string | null;
          current_step?: number;
          status?: "active" | "paused" | "completed";
          notes?: string | null;
          duration_minutes?: number | null;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lesson_tasks: {
        Row: {
          id: string;
          teacher_id: string;
          created_by: string | null;
          target_user_id: string | null;
          session_id: string | null;
          poem_id: string | null;
          poem_title: string | null;
          title: string;
          detail: string | null;
          task_config: Json;
          task_type: string;
          status: string;
          to: string | null;
          due_at: string | null;
          due_date: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          created_by?: string | null;
          target_user_id?: string | null;
          session_id?: string | null;
          poem_id?: string | null;
          poem_title?: string | null;
          title: string;
          detail?: string | null;
          task_config?: Json;
          task_type?: string;
          status?: string;
          to?: string | null;
          due_at?: string | null;
          due_date?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          teacher_id?: string;
          created_by?: string | null;
          target_user_id?: string | null;
          session_id?: string | null;
          poem_id?: string | null;
          poem_title?: string | null;
          title?: string;
          detail?: string | null;
          task_config?: Json;
          task_type?: string;
          status?: string;
          to?: string | null;
          due_at?: string | null;
          due_date?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      classes: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          teacher_id: string;
          invite_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          teacher_id: string;
          invite_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          teacher_id?: string;
          invite_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      class_members: {
        Row: {
          id: string;
          class_id: string;
          user_id: string;
          role: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          user_id: string;
          role?: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          class_id?: string;
          user_id?: string;
          role?: string;
          joined_at?: string;
        };
        Relationships: [];
      };
      chat_summaries: {
        Row: {
          id: string;
          user_id: string;
          mode: string;
          poet: string | null;
          poem_title: string | null;
          poem_author: string | null;
          poem_context: string | null;
          summary: string;
          key_points: Json;
          last_question: string | null;
          message_count: number;
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode?: string;
          poet?: string | null;
          poem_title?: string | null;
          poem_author?: string | null;
          poem_context?: string | null;
          summary: string;
          key_points?: Json;
          last_question?: string | null;
          message_count?: number;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          mode?: string;
          poet?: string | null;
          poem_title?: string | null;
          poem_author?: string | null;
          poem_context?: string | null;
          summary?: string;
          key_points?: Json;
          last_question?: string | null;
          message_count?: number;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
