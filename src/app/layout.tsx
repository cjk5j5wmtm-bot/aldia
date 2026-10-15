import type { Metadata } from "next";
import { Suspense } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Nav } from "./nav";
import { getStore } from "@/lib/server/store";
import { resetDemoAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Al Día",
  description: "El cierre de mes de tu cartera de alquileres, en una tarde.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const store = getStore();
  return (
    <html lang="es-AR" className={`${GeistSans.variable} ${GeistMono.variable}`} style={{ ["--font-geist" as string]: "var(--font-geist-sans)" }}>
      <body>
        {store.org.isDemo && (
          <div className="demo-banner" role="note">
            Modo demo: todos los datos son ficticios y los índices son valores inventados. Al Día no envía mensajes ni mueve dinero.
          </div>
        )}
        <div className="shell">
          <aside className="side">
            <a className="brand" href="/">
              <svg width="26" height="26" viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" rx="8" fill="#2443d6" /><path d="M8 15.5l4.5 4.5L22 10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Al Día
            </a>
            <Suspense fallback={null}><Nav /></Suspense>
            <div className="foot">
              <span>{store.org.name}</span>
              {store.org.isDemo && (
                <form action={resetDemoAction}>
                  <button className="btn ghost" type="submit">Reiniciar la demo</button>
                </form>
              )}
            </div>
          </aside>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
