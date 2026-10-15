import { Suspense } from "react";
import { requireApp } from "@/lib/server/store";
import { Logo } from "@/lib/view";
import { logoutAction } from "../(cuenta)/actions";
import { resetDemoAction } from "../actions";
import { Nav } from "../nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { store, user } = await requireApp();
  return (
    <>
      {store.org.isDemo && (
        <div className="demo-banner" role="note">
          Estás usando datos de ejemplo: las personas son ficticias y los índices, inventados. Al Día no envía mensajes ni mueve dinero.
        </div>
      )}
      <div className="shell">
        <aside className="side">
          <a className="brand" href="/"><Logo /> Al Día</a>
          <Suspense fallback={null}><Nav /></Suspense>
          <div className="foot">
            <span><b>{store.org.name}</b><br />{user.email}</span>
            {store.org.isDemo && (
              <form action={resetDemoAction}><button className="link-btn" type="submit">Reiniciar datos de ejemplo</button></form>
            )}
            <form action={logoutAction}><button className="link-btn" type="submit">Salir</button></form>
          </div>
        </aside>
        <main>{children}</main>
      </div>
    </>
  );
}
