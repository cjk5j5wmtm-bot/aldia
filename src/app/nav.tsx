"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  "/": <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  "/cierre": <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>,
  "/cobranzas": <><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20M6 15h4" /></>,
  "/propietarios": <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  "/contratos": <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></>,
};

const ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/cierre", label: "Cierre del mes" },
  { href: "/cobranzas", label: "Cobranzas" },
  { href: "/propietarios", label: "Propietarios" },
  { href: "/contratos", label: "Contratos" },
];

export function Nav() {
  const path = usePathname();
  const sp = useSearchParams();
  const q = sp.get("periodo") ? `?periodo=${sp.get("periodo")}` : "";
  return (
    <nav className="nav" aria-label="Secciones">
      {ITEMS.map((i) => {
        const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={`${i.href}${q}`} aria-current={active ? "page" : undefined}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[i.href]}</svg>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
