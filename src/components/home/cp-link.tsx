"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { CpDestination } from "@/lib/home-nav";

/**
 * Renders one Home Screen destination with the right element for its kind:
 * next/link for app routes, a real <a> for the ported static pages and
 * anchors, a button for in-page actions, and a plainly-labelled inert item
 * for things that have no page yet (so the design shows them without
 * shipping a dead link).
 */
export function CpLink({
  to,
  className,
  children,
  onNavigate,
  onAction,
  label,
}: {
  to: CpDestination;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
  onAction?: (action: "menu" | "share") => void;
  label?: string;
}) {
  switch (to.kind) {
    case "route":
      return (
        <Link href={to.href} className={className} aria-label={label} onClick={onNavigate}>
          {children}
        </Link>
      );
    case "static":
    case "hash":
      return (
        <a href={to.href} className={className} aria-label={label} onClick={onNavigate}>
          {children}
        </a>
      );
    case "action":
      return (
        <button
          type="button"
          className={className}
          aria-label={label}
          onClick={() => onAction?.(to.action)}
        >
          {children}
        </button>
      );
    case "soon":
    default:
      return (
        <span
          className={`${className ?? ""} cursor-default opacity-70`}
          aria-disabled="true"
          title="Coming soon"
        >
          {children}
        </span>
      );
  }
}
