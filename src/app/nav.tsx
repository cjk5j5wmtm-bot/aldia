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

const SHORT: Record<string, string> = { "/": "Inicio", "/cierre": "Cierre", "/cobranzas": "Cobranzas", "/propietarios": "Dueños", "/contratos": "Contratos" };

/** Menú de secciones: lateral en escritorio y barra inferior en celular (variant="tabbar"). */
export function Nav({ variant = "side" }: { variant?: "side" | "tabbar" }) {
  const path = usePathname();
  const sp = useSearchParams();
  const q = sp.get("periodo") ? `?periodo=${sp.get("periodo")}` : "";
  return (
    <nav className={variant === "tabbar" ? "tabbar" : "nav"} aria-label="Secciones">
      {ITEMS.map((i) => {
        const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={`${i.href}${q}`} aria-current={active ? "page" : undefined}>
            <svg width={variant === "tabbar" ? 22 : 18} height={variant === "tabbar" ? 22 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[i.href]}</svg>
            {variant === "tabbar" ? SHORT[i.href] : i.label}
          </Link>
        );
      })}
    </nav>
  );
}
