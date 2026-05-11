type StampProps = {
  text: string;
};

export function Stamp({ text }: StampProps) {
  const isSingle = text.length <= 1;
  return (
    <span
      className={`inline-flex items-center justify-center bg-cinnabar text-white font-serif rounded-tag -rotate-2 bg-opacity-90 ${isSingle ? "w-12 h-12" : "px-3 h-12"}`}
    >
      {text}
    </span>
  );
}
