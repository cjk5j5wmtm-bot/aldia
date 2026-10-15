"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/cierre", label: "Cierre del mes" },
  { href: "/contratos", label: "Contratos" },
  { href: "/cobranzas", label: "Cobranzas" },
  { href: "/propietarios", label: "Propietarios" },
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
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
