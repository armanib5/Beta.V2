import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MobileNav } from "@/components/mobile-nav";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const links = [
    { href: "/vendors", label: "Vendor Directory" },
    { href: "/#pricing", label: "Become a Vendor" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <span aria-hidden="true">📍</span>
          CityPinned
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={user ? "/vendor/dashboard" : "/vendor/login"}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            {user ? "My Dashboard" : "Vendor Login"}
          </Link>
        </nav>

        <MobileNav links={links} isSignedIn={Boolean(user)} />
      </div>
    </header>
  );
}
