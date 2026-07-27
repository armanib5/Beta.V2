/**
 * A designed flyer card for anything with no real photo/graphic yet — not
 * a generic gray box, a distinct color per category/name so a wall of
 * these still reads as "a bunch of different flyers" instead of "a bunch
 * of blanks". Deterministic (same name always gets the same color), so it
 * never flickers between reloads and needs no image-generation tool.
 */
function hueFromString(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

export function FlyerPlaceholder({
  seed,
  icon,
  label,
  className,
}: {
  seed: string;
  icon?: string | null;
  label?: string | null;
  className?: string;
}) {
  const hue = hueFromString(seed);
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 text-white ${className ?? ""}`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 65% 42%), hsl(${(hue + 35) % 360} 70% 32%))`,
      }}
    >
      <span className="text-3xl drop-shadow" aria-hidden="true">
        {icon || "📌"}
      </span>
      {label && (
        <span className="max-w-[90%] truncate text-center text-[10px] font-semibold uppercase tracking-wide opacity-90">
          {label}
        </span>
      )}
    </div>
  );
}
