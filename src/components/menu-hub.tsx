import { formatPrice, type MenuItem } from "@/lib/types";

export function MenuHub({
  items,
  happyHourSpecials,
}: {
  items: MenuItem[];
  happyHourSpecials: string | null;
}) {
  const active = items.filter((i) => i.status === "active");
  const bites = active.filter((i) => i.kind === "bite");
  const sips = active.filter((i) => i.kind === "sip");

  if (!active.length && !happyHourSpecials) return null;

  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-900">🍽️ Menu Hub</h2>

      {happyHourSpecials && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Happy Hour / Daily Specials</p>
          <p className="mt-1 text-sm text-amber-900">{happyHourSpecials}</p>
        </div>
      )}

      <MenuKindList title="🥟 Top Bites" items={bites} />
      <MenuKindList title="🥤 Top Sips" items={sips} />
    </div>
  );
}

function MenuKindList({ title, items }: { title: string; items: MenuItem[] }) {
  if (!items.length) return null;
  const topPicks = items.filter((i) => i.is_top_pick);
  const rest = items.filter((i) => !i.is_top_pick);
  const ordered = [...topPicks, ...rest];

  return (
    <div className="mt-5">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {ordered.map((item) => (
          <div key={item.id} className="flex gap-3 rounded-xl border border-slate-200 p-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {item.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.photo_url} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xl text-slate-300">🍽️</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {item.is_top_pick && <span className="text-amber-500">★</span>}
                <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
              </div>
              {item.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{item.description}</p>}
              {item.price_cents != null && (
                <p className="mt-1 text-xs font-semibold text-slate-700">{formatPrice(item.price_cents)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
