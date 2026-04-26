export type WrongStatus = "pending" | "mastered" | "retry";

export interface WrongQuestionRow {
  id: string;
  question_id?: string | null;
  poem_title: string;
  question_content: string;
  user_answer: string;
  correct_answer: string;
  explanation: string;
  error_type: string | null;
  question_kind: string | null;
  keyword_tags: string[];
  dynasty: string | null;
  theme: string | null;
  status: WrongStatus;
  created_at: string;
}

export interface WrongDimensionStat {
  value: string;
  count: number;
  ratio: number;
}

export interface WrongTrendPoint {
  date: string;
  created: number;
  mastered: number;
}

export interface WrongTrendDisplayRow {
  key: string;
  label: string;
  created: number;
  mastered: number;
  startDate: string;
  endDate: string;
}
