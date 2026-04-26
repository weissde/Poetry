import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Session, User } from "@supabase/supabase-js";
import { requireSupabase } from "@/lib/supabase";

const AUTH_INIT_TIMEOUT_MS = 10000;

interface AuthStoreState {
  user: User | null;
  session: Session | null;
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
  notice: string | null;
  _unsubscribe: (() => void) | null;
  initialize: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  clearNotice: () => void;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export const useAuthStore = create<AuthStoreState>()(
  immer((set, get) => ({
    user: null,
    session: null,
    initialized: false,
    isLoading: false,
    error: null,
    notice: null,
    _unsubscribe: null,

    initialize: async () => {
      if (get().initialized) {
        return;
      }

      set((state) => {
        state.isLoading = true;
        state.error = null;
        state.notice = null;
      });

      try {
        const { data, error } = await withTimeout(
          requireSupabase().auth.getSession(),
          AUTH_INIT_TIMEOUT_MS,
          "认证初始化超时，请检查网络或 Supabase 配置。",
        );
        if (error) {
          throw error;
        }

        set((state) => {
          state.session = data.session;
          state.user = data.session?.user ?? null;
          state.initialized = true;
        });

        const {
          data: { subscription },
        } = requireSupabase().auth.onAuthStateChange((_event, session) => {
          set((state) => {
            state.session = session;
            state.user = session?.user ?? null;
          });
        });

        set((state) => {
          state._unsubscribe = () => subscription.unsubscribe();
        });
      } catch (error: unknown) {
        set((state) => {
          state.error = error instanceof Error ? error.message : "认证初始化失败";
          state.session = null;
          state.user = null;
        });
      } finally {
        set((state) => {
          state.isLoading = false;
          state.initialized = true;
        });
      }
    },

    signInWithPassword: async (email, password) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
        state.notice = null;
      });

      try {
        const { data, error } = await requireSupabase().auth.signInWithPassword({ email, password });
        if (error) {
          throw error;
        }

        set((state) => {
          state.session = data.session;
          state.user = data.user;
        });
      } catch (error: unknown) {
        set((state) => {
          state.error = error instanceof Error ? error.message : "登录失败";
        });
      } finally {
        set((state) => {
          state.isLoading = false;
        });
      }
    },

    signUpWithPassword: async (email, password) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const { data, error } = await requireSupabase().auth.signUp({ email, password });
        if (error) {
          throw error;
        }

        set((state) => {
          state.session = data.session;
          state.user = data.user;
          if (data.session && data.user) {
            state.notice = "注册成功，已自动登录。";
          } else {
            state.notice = "注册成功，请先完成邮箱验证后再登录。";
          }
        });
      } catch (error: unknown) {
        set((state) => {
          state.error = error instanceof Error ? error.message : "注册失败";
        });
      } finally {
        set((state) => {
          state.isLoading = false;
        });
      }
    },

    signOut: async () => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const { error } = await requireSupabase().auth.signOut({ scope: "local" });
        if (error) {
          throw error;
        }
      } catch (error: unknown) {
        set((state) => {
          state.error = error instanceof Error ? error.message : "退出登录失败";
        });
      } finally {
        set((state) => {
          state.session = null;
          state.user = null;
          state.isLoading = false;
        });
      }
    },

    clearError: () => {
      set((state) => {
        state.error = null;
      });
    },

    clearNotice: () => {
      set((state) => {
        state.notice = null;
      });
    },
  })),
);

export function disposeAuthStoreSubscription(): void {
  const unsubscribe = useAuthStore.getState()._unsubscribe;
  if (unsubscribe) {
    unsubscribe();
    useAuthStore.setState({ _unsubscribe: null });
  }
}
