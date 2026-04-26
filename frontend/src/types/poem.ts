export interface Poem {
  id: string;
  title: string;
  author: string;
  dynasty: string;
  content: string;
  gradeLevel: "primary" | "middle" | "high";
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
