import { Suspense } from "react";
import { requireApp } from "@/lib/server/store";
import { Logo, Wordmark } from "@/lib/view";
import { logoutAction } from "../(cuenta)/actions";
import { resetDemoAction } from "../actions";
import { Nav } from "../nav";

const initials = (name: string) => name.split(/\s+/).filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(w)).slice(-2).map((w) => w[0]).join("").toUpperCase() || "AL";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { store, user } = await requireApp();
  const Profile = () => (
    <details className="profile">
      <summary aria-label={`Tu cuenta: ${store.org.name}`} title={store.org.name}>{initials(store.org.name)}</summary>
      <div className="profile-menu" role="menu">
        <div className="profile-id"><b>{store.org.name}</b><span>{user.email}</span></div>
        <a className="menu-item" href="/bienvenida" role="menuitem">Cambiar mis respuestas</a>
        {store.org.isDemo && (
          <form action={resetDemoAction}><button className="menu-item" type="submit" role="menuitem">Reiniciar datos de ejemplo</button></form>
        )}
        <form action={logoutAction}><button className="menu-item danger" type="submit" role="menuitem">Cerrar sesión</button></form>
      </div>
    </details>
  );
  return (
    <>
      {store.org.isDemo && (
        <div className="demo-banner" role="note">
          Estás usando datos de ejemplo: las personas son ficticias y los índices, inventados. Aldia no envía mensajes ni mueve dinero.
        </div>
      )}
      <div className="shell">
        <aside className="side">
          <div className="side-top">
            <a className="brand" href="/"><Logo size={26} /> <Wordmark /></a>
            <Profile />
          </div>
          <Suspense fallback={null}><Nav /></Suspense>
        </aside>
        <main><div className="topbar"><Profile /></div>{children}</main>
      </div>
      <Suspense fallback={null}><Nav variant="tabbar" /></Suspense>
    </>
  );
}
