import type { TeachingUnitItem } from "@/types";
import { TiltedCard } from "@/components/react-bits";

interface UnitGridProps {
  units: TeachingUnitItem[];
  onSelectUnit?: (unit: TeachingUnitItem) => void;
}

export function UnitGrid({ units, onSelectUnit }: UnitGridProps): JSX.Element {
  if (units.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-2xl bg-stone-50 border border-dashed border-stone-200">
        <p className="text-sm text-slate-500">暂无课程单元数据，请联系管理员添加。</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {units.map((unit) => (
        <TiltedCard key={unit.id} className="h-full">
          <div
            className="group flex h-full w-full flex-col rounded-[24px] bg-white p-4 text-left shadow-[0_12px_28px_rgba(26,43,76,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(26,43,76,0.13)]"
          >
            <div className="rounded-2xl bg-[linear-gradient(135deg,#EFE6DE,#D6BFA9)] px-3 py-3">
              <p className="text-[11px] tracking-[0.14em] text-[#76563D]">COURSE UNIT</p>
              <h3 className="mt-1 font-serif text-xl text-[#1A2B4C]">{unit.title}</h3>
              <p className="mt-1 text-xs text-[#76563D] opacity-80">{unit.gradeLevel.join(" · ")}</p>
            </div>
            
            <div className="mt-3 flex-1 px-1">
              <p className="text-xs text-slate-600 line-clamp-2">{unit.subtitle}</p>
            </div>
            
            <div className="mt-4 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-[#C9A96E]" style={{ width: '0%' }} />
                </div>
                <span className="text-[10px] text-slate-400">未开始</span>
              </div>
              <button 
                type="button" 
                onClick={() => onSelectUnit?.(unit)}
                className="text-xs font-medium text-[#C9A96E] hover:text-[#B68747]"
              >
                查看
              </button>
            </div>
          </div>
        </TiltedCard>
      ))}
    </div>
  );
}
