import { Play } from "lucide-react";
import { Link } from "react-router-dom";

export function StartDemoButton() {
  return (
    <Link
      to="/learn"
      className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-[linear-gradient(135deg,#e8c886_0%,#c8a96e_100%)] px-8 py-4 font-serif text-lg font-medium text-white shadow-[0_12px_24px_rgba(200,169,110,0.3)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(200,169,110,0.4)]"
    >
      <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
      <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
        <Play className="h-4 w-4 fill-white" />
      </span>
      <span className="relative z-10">开始课堂演示</span>
    </Link>
  );
}
