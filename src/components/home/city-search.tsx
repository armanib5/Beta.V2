"use client";

import { useId, useState } from "react";
import { CpLink } from "@/components/home/cp-link";
import { IconMapPin, IconSearch } from "@/components/home/icons";
import { CORKBOARD_URL, soon } from "@/lib/home-nav";

/**
 * "Explore Your City" — CityPinned is in beta with Downtown San Jose live
 * today, so the search resolves a typed city against the cities that
 * actually have a board and says so plainly when it doesn't match. No
 * backend is involved; it routes to the existing board.
 */
const LIVE_CITIES = [
  {
    name: "San Jose",
    aliases: ["san jose", "downtown san jose", "san jose ca", "sj", "baypinned", "95113"],
    href: CORKBOARD_URL,
  },
];

export function CitySearch() {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [notFound, setNotFound] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const needle = query.trim().toLowerCase();
    if (!needle) return;
    const match = LIVE_CITIES.find(
      (city) =>
        city.aliases.some((alias) => alias.includes(needle) || needle.includes(alias)) ||
        city.name.toLowerCase().includes(needle),
    );
    if (match) {
      setNotFound(false);
      window.location.href = match.href;
      return;
    }
    setNotFound(true);
  }

  return (
    <div className="cp-glass p-4 sm:p-5">
      <div className="cp-content">
        <div className="flex items-center gap-2.5">
          <span className="cp-matte-panel flex h-9 w-9 items-center justify-center rounded-full">
            <IconMapPin className="cp-content h-5 w-5 text-slate-200" />
          </span>
          <h2 className="cp-chrome-text text-lg font-bold sm:text-xl">Explore Your City</h2>
        </div>

        <form onSubmit={submit} className="mt-3 flex items-center gap-2">
          <label htmlFor={inputId} className="sr-only">
            Search your city
          </label>
          <div className="cp-inset flex-1">
            <input
              id={inputId}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (notFound) setNotFound(false);
              }}
              placeholder="Search your city..."
              autoComplete="address-level2"
              className="w-full bg-transparent px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            aria-label="Search"
            className="cp-btn-pop cp-press flex h-12 w-12 shrink-0 items-center justify-center"
          >
            <IconSearch className="cp-content h-5 w-5 text-slate-100" />
          </button>
        </form>

        <p className="mt-3 text-[13px] leading-snug text-slate-400">
          Can&apos;t find your city yet?
          <br />
          It isn&apos;t there yet, still in beta.{" "}
          <CpLink to={soon} className="cp-chrome-text font-semibold">
            Request your city here!
          </CpLink>
        </p>

        {notFound && (
          <p
            role="status"
            className="cp-matte-panel mt-3 px-4 py-3 text-[13px] leading-snug text-slate-300"
          >
            <span className="cp-content block">
              No board for “{query.trim()}” yet. CityPinned is live in{" "}
              <a href={CORKBOARD_URL} className="cp-chrome-text font-semibold">
                Downtown San Jose
              </a>{" "}
              while we&apos;re in beta — more cities are being pinned.
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
