type PrefetchLoader = () => Promise<unknown>;

const loadedModules = new Set<string>();

const routeLoaders: Array<{
  route: string;
  loader: PrefetchLoader;
}> = [
  { route: "/", loader: () => import("@/pages/Home") },
  { route: "/explore", loader: () => import("@/pages/Explore") },
  { route: "/learn", loader: () => import("@/pages/Learn") },
  { route: "/practice", loader: () => import("@/pages/Practice") },
  // `/memory` and `/exam` now redirect into the shared practice workspace.
  { route: "/memory", loader: () => import("@/pages/Practice") },
  { route: "/exam", loader: () => import("@/pages/Practice") },
  { route: "/my-learning", loader: () => import("@/pages/MyLearning") },
  { route: "/create", loader: () => import("@/pages/Create") },
  { route: "/graph", loader: () => import("@/pages/Graph") },
  { route: "/login", loader: () => import("@/pages/Login") },
];

function shouldMatchRoute(path: string, route: string): boolean {
  if (route === "/") {
    return path === "/";
  }
  return path === route || path.startsWith(`${route}/`);
}

export function prefetchRoute(path: string): void {
  const normalized = (path || "").trim().toLowerCase();
  if (!normalized) {
    return;
  }

  const hit = routeLoaders.find((item) => shouldMatchRoute(normalized, item.route));
  if (!hit) {
    return;
  }

  if (loadedModules.has(hit.route)) {
    return;
  }
  loadedModules.add(hit.route);

  void hit.loader().catch(() => {
    loadedModules.delete(hit.route);
  });
}
