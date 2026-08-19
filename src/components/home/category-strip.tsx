"use client";

import { useState } from "react";
import Link from "next/link";
import type { Category } from "@/lib/types";
import {
  IconArrowRight,
  IconBag,
  IconBasket,
  IconLeaf,
  IconTag,
  IconUtensils,
} from "@/components/home/icons";

/** Line icon for a category, falling back to the icon stored on the row. */
function categoryIcon(category: Category) {
  const key = `${category.slug} ${category.name}`.toLowerCase();
  const cls = "h-4 w-4 shrink-0 text-slate-100";
  if (/season|holiday|winter|summer|produce|farm/.test(key)) return <IconLeaf className={cls} />;
  if (/market|grocer|basket/.test(key)) return <IconBasket className={cls} />;
  if (/shop|retail|boutique|craft|artisan|maker|jewel|apparel|beauty/.test(key))
    return <IconBag className={cls} />;
  if (/food|restaurant|cook|eat|bake|dessert|drink|coffee|tea|truck/.test(key))
    return <IconUtensils className={cls} />;
  if (category.icon) {
    return (
      <span aria-hidden="true" className="shrink-0 text-sm leading-none grayscale">
        {category.icon}
      </span>
    );
  }
  return <IconTag className={cls} />;
}

const PRIMARY_COUNT = 4;

/**
 * The primary categories with a "More Categories" control. The control
 * reveals the rest of the real categories in place — the four shown first
 * are a starting point, not a cap — and links on to the full directory.
 */
export function CategoryStrip({ categories }: { categories: Category[] }) {
  const [expanded, setExpanded] = useState(false);
  const primary = categories.slice(0, PRIMARY_COUNT);
  const rest = categories.slice(PRIMARY_COUNT);
  const shown = expanded ? categories : primary;

  return (
    <section aria-labelledby="cp-categories-heading">
      <div className="flex items-center gap-3">
        <span className="cp-rule flex-1" />
        <h2
          id="cp-categories-heading"
          className="cp-chrome-text text-[11px] font-bold uppercase tracking-[0.3em] sm:text-sm"
        >
          Explore Local Categories
        </h2>
        <span className="cp-rule flex-1" />
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 sm:gap-3">
        {shown.map((category) => (
          <li key={category.id} className="cp-glass flex items-center justify-center px-3 py-2.5">
            <span className="cp-content flex min-w-0 items-center gap-2">
              {categoryIcon(category)}
              <span className="cp-chrome-text truncate text-[12px] font-semibold sm:text-[13px]">
                {category.name}
              </span>
            </span>
          </li>
        ))}

        <li>
          {rest.length > 0 ? (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((prev) => !prev)}
              className="cp-glass cp-press flex h-full w-full items-center justify-center px-3 py-2.5 text-center"
            >
              <span className="cp-chrome-text cp-content text-[12px] font-semibold leading-tight">
                {expanded ? "Fewer" : "More"}
                <br className="hidden sm:block" /> Categories
              </span>
            </button>
          ) : (
            <Link
              href="/vendors"
              className="cp-glass cp-press flex h-full w-full items-center justify-center px-3 py-2.5 text-center"
            >
              <span className="cp-chrome-text cp-content text-[12px] font-semibold leading-tight">
                More
                <br className="hidden sm:block" /> Categories
              </span>
            </Link>
          )}
        </li>
      </ul>

      {expanded && (
        <Link
          href="/vendors"
          className="cp-press cp-focus mt-3 flex items-center justify-center gap-1.5 rounded-full py-1 text-[12px] font-semibold text-slate-300 hover:text-white"
        >
          Browse the full directory
          <IconArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </section>
  );
}
