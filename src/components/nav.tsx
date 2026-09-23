"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV = [
  { href: "/", label: "둘러보기" },
  { href: "/inbox", label: "받은함" },
  { href: "/eval", label: "평가" },
  { href: "/decisions", label: "설계 결정" },
] as const;

export function Nav() {
  const path = usePathname();
  const tour = useSearchParams().has("tour");
  const active = (href: string) =>
    href === "/" ? path === "/" || tour : path.startsWith(href) || (href === "/inbox" && path.startsWith("/tickets") && !tour);
  return (
    <nav className="flex gap-1 text-sm">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={active(n.href) ? "page" : undefined}
          className={`whitespace-nowrap rounded-md px-2.5 py-1.5 ${active(n.href) ? "bg-accent/10 font-medium text-accent" : "text-muted hover:text-ink"}`}
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
