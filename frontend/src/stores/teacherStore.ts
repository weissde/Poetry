import { create } from 'zustand';

interface ClassInfo {
  id: string;
  name: string;
  studentCount: number;
}

interface TaskInfo {
  id: string;
  title: string;
  status: string;
}

interface ClassStats {
  averageAccuracy: number;
  activeStudents: number;
}

interface TeacherState {
  classes: ClassInfo[];
  selectedClassId: string | null;
  tasks: TaskInfo[];
  classStats: ClassStats | null;

  // Actions
  setSelectedClass: (classId: string) => void;
  fetchClasses: () => Promise<void>;
  fetchTasks: () => Promise<void>;
  fetchClassStats: (classId: string) => Promise<void>;
}

export const useTeacherStore = create<TeacherState>()((set) => ({
  classes: [],
  selectedClassId: null,
  tasks: [],
  classStats: null,

  setSelectedClass: (classId) => set({ selectedClassId: classId }),
  
  fetchClasses: async () => {
    // TODO: implement fetch
    set({ classes: [] });
  },

  fetchTasks: async () => {
    // TODO: implement fetch
    set({ tasks: [] });
  },

  fetchClassStats: async (_classId) => {
    // TODO: implement fetch
    set({ classStats: null });
  }
}));
