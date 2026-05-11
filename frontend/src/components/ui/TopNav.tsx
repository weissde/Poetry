import { cn } from "@/lib/cn";

type TabKey = "shici" | "tanjiu" | "liance" | "tupu" | "chuangzuo" | "xueqing";

type TopNavProps = {
  mode: "teacher" | "student";
  activeTab: TabKey;
  onModeSwitch: () => void;
  userName: string;
};

const TAB_LABEL: Record<TabKey, string> = {
  shici: "诗词",
  tanjiu: "探究",
  liance: "链测",
  tupu: "图谱",
  chuangzuo: "创作",
  xueqing: "学情",
};

const TAB_ROUTE: Record<TabKey, string> = {
  shici: "/learn",
  tanjiu: "/explore",
  liance: "/practice",
  tupu: "/graph",
  chuangzuo: "/create",
  xueqing: "/my-learning",
};

export function TopNav({
  mode,
  activeTab,
  onModeSwitch,
  userName,
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-40 bg-paper-0 border-b border-ink-100">
      {/* 第一行：主导航 */}
      <div className="flex h-14 items-center px-6">
        {/* 左：Logo + 产品名 */}
        <a href="/" className="flex items-center gap-2 no-underline">
          <span className="w-8 h-8 flex items-center justify-center bg-gold-500 text-white font-display text-[16px] rounded-lg shadow-gold">
            诗
          </span>
          <span className="font-display text-[18px] text-gold-500">诗境通</span>
        </a>

        {/* 中：6 个页签 */}
        <nav className="ml-10 flex items-center gap-1">
          {(Object.keys(TAB_LABEL) as TabKey[]).map((key) => {
            const isActive = key === activeTab;
            return (
              <a
                key={key}
                href={TAB_ROUTE[key]}
                className={cn(
                  "relative px-3 py-1 text-[14px] transition-colors no-underline",
                  isActive
                    ? "text-gold-600 font-medium"
                    : "text-text-muted hover:text-text-primary",
                )}
              >
                {TAB_LABEL[key]}
                {isActive && (
                  <span className="absolute bottom-[-9px] left-0 right-0 h-[2px] bg-gold-500" />
                )}
              </a>
            );
          })}
        </nav>

        {/* 右：模式切换 + 用户名 + 头像 */}
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={onModeSwitch}
            className={cn(
              "h-7 px-3 rounded-full text-[12px] font-medium border transition-colors flex items-center gap-2",
              mode === "teacher"
                ? "border-gold-500/30 text-gold-600"
                : "border-ink-300/60 text-ink-600",
            )}
          >
            <span
              className={cn(
                "inline-block w-2 h-2 rounded-full",
                mode === "teacher" ? "bg-gold-500" : "bg-ink-400",
              )}
            />
            {mode === "teacher" ? "教师" : "学生"}
          </button>
          <span className="text-[14px] text-text-primary">{userName}</span>
          <span className="w-8 h-8 flex items-center justify-center rounded-full bg-gold-500 text-white font-display text-[14px]">
            {userName.charAt(0)}
          </span>
        </div>
      </div>

      {/* 第二行：路径条 */}
      <div className="h-9 flex items-center px-6 bg-paper-50/50 border-b border-ink-100 text-[12px] text-text-muted">
        <span>总览</span>
        <span className="mx-2 text-ink-300">→</span>
        <span>精讲</span>
        <span className="mx-2 text-ink-300">→</span>
        <span>练习</span>
        <span className="mx-2 text-ink-300">→</span>
        <span>回顾</span>
      </div>
    </header>
  );
}
