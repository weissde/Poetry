import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { MotionPreferenceProvider } from "@/contexts/MotionPreferenceContext";
import { TeachingModeProvider } from "@/contexts/TeachingModeContext";
import PlaceholderPage from "@/pages/Placeholder";
import { useAuthStore } from "@/stores/authStore";

const LoginPage = lazy(() => import("@/pages/Login"));
const HomePage = lazy(() => import("@/pages/Home"));
const LearnPage = lazy(() => import("@/pages/Learn"));
const ExplorePage = lazy(() => import("@/pages/Explore"));
const PracticePage = lazy(() => import("@/pages/Practice"));
const MyLearningPage = lazy(() => import("@/pages/MyLearning"));
const CreatePage = lazy(() => import("@/pages/Create"));
const GraphPage = lazy(() => import("@/pages/Graph"));
const TeacherPage = lazy(() => import("@/pages/Teacher"));

function AuthInitLoading(): JSX.Element {
  return (
    <div className="app-loading-screen">
      <div className="app-loading-inner">
        <p className="app-loading-card">正在初始化会话...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, role }: { children: JSX.Element, role?: string }): JSX.Element {
  const { user, initialized, initialize } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (!initialized) {
      void initialize();
    }
  }, [initialized, initialize]);

  if (!initialized) {
    return <AuthInitLoading />;
  }

  if (!user) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function GuestOnlyRoute({ children }: { children: JSX.Element }): JSX.Element {
  const { user, initialized, initialize } = useAuthStore();

  useEffect(() => {
    if (!initialized) {
      void initialize();
    }
  }, [initialized, initialize]);

  if (!initialized) {
    return <AuthInitLoading />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function NotFoundPage(): JSX.Element {
  return <PlaceholderPage title="页面未找到" description="你访问的页面不存在，请通过导航返回可用页面。" />;
}

function RouteLoading(): JSX.Element {
  return (
    <div className="app-loading-screen">
      <div className="app-loading-inner">
        <p className="app-loading-card">页面加载中...</p>
      </div>
    </div>
  );
}

function RedirectWithSearch({ to }: { to: string }): JSX.Element {
  const location = useLocation();
  const hasQuery = location.search.length > 0;
  const separator = to.includes("?") ? "&" : "?";
  return <Navigate to={`${to}${hasQuery ? `${separator}${location.search.slice(1)}` : ""}`} replace />;
}

function LegacyExplorePoemRedirect(): JSX.Element {
  const location = useLocation();
  const { poemId } = useParams<{ poemId: string }>();
  const target = poemId ? `/explore?poemId=${encodeURIComponent(poemId)}${location.search}` : `/explore${location.search}`;
  return <Navigate to={target} replace />;
}

export default function App(): JSX.Element {
  return (
    <MotionPreferenceProvider>
      <TeachingModeProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route
                path="/login"
                element={
                  <GuestOnlyRoute>
                    <LoginPage />
                  </GuestOnlyRoute>
                }
              />

              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route path="/learn" element={<LearnPage />} />
                <Route path="/learn/:poemId" element={<LearnPage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/practice" element={<PracticePage />} />
                <Route path="/exam" element={<RedirectWithSearch to="/practice?entry=exam" />} />
                <Route path="/memory" element={<RedirectWithSearch to="/practice?entry=memory" />} />
                <Route path="/my-learning" element={<MyLearningPage />} />
                <Route path="/create" element={<CreatePage />} />
                <Route path="/create/plaza" element={<RedirectWithSearch to="/create?tab=plaza" />} />
                <Route path="/graph" element={<GraphPage />} />
                <Route path="/profile" element={<RedirectWithSearch to="/my-learning" />} />
                <Route path="/home" element={<RedirectWithSearch to="/" />} />
                <Route path="/explore/:poemId" element={<LegacyExplorePoemRedirect />} />
              </Route>

              <Route
                element={
                  <ProtectedRoute role="teacher">
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route path="/teacher" element={<TeacherPage />} />
              </Route>

              <Route element={<Layout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TeachingModeProvider>
    </MotionPreferenceProvider>
  );
}
