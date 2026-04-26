import { create } from 'zustand';

interface PlazaCreation {
  id: string;
  title: string;
  author: string;
  content: string;
  likes: number;
  comments: number;
}

interface PlazaState {
  creations: PlazaCreation[];
  page: number;
  hasMore: boolean;
  sortBy: 'latest' | 'hot';
  loading: boolean;

  // Actions
  fetchCreations: (reset?: boolean) => Promise<void>;
  likeCreation: (id: string) => Promise<void>;
  publishCreation: (content: string) => Promise<void>;
  setSortBy: (sort: PlazaState['sortBy']) => void;
}

export const usePlazaStore = create<PlazaState>()((set) => ({
  creations: [],
  page: 1,
  hasMore: true,
  sortBy: 'latest',
  loading: false,

  fetchCreations: async (_reset = false) => {
    set({ loading: true });
    // TODO: implement fetch
    set({ loading: false });
  },

  likeCreation: async (_id) => {
    // TODO: implement like
  },

  publishCreation: async (_content) => {
    // TODO: implement publish
  },

  setSortBy: (sort) => set({ sortBy: sort })
}));
