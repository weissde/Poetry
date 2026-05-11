type ProgressDotsProps = {
  total: number;
  done: number;
  todayIndex?: number;
};

export function ProgressDots({ total, done, todayIndex }: ProgressDotsProps) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const isDone = i < done;
        const isToday = todayIndex !== undefined && i === todayIndex;
        let className = "w-2 h-2 rounded-full ";
        if (isDone) {
          className += "bg-cinnabar";
        } else if (isToday) {
          className += "border-2 border-cinnabar";
        } else {
          className += "bg-ink-300";
        }
        return <span key={i} className={className} />;
      })}
    </div>
  );
}
