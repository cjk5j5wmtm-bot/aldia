import Link from "next/link";
import { QuickAdd } from "./quick-add";
import { chargesFor } from "@/lib/domain/charges";
import { closeStatus, type Task as CloseTask } from "@/lib/domain/close";
import { formatMoney } from "@/lib/domain/money";
import { formatPeriod } from "@/lib/domain/period";
import { periodFrom, requireApp, today } from "@/lib/server/store";
import { M, PeriodPicker, Stepper, totalsByCurrency } from "@/lib/view";

const Task = ({ t }: { t: CloseTask }) => (
  <li>
    <div className="t"><b>{t.title}</b><span>{t.detail}</span></div>
    <Link className="btn ghost" href={t.href}>Ir</Link>
  </li>
);

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { store } = await requireApp();
  const period = periodFrom(store, sp);
  const st = closeStatus(store, period, today(store));
  const charges = chargesFor(store, period, today(store));
  const [main, ...others] = totalsByCurrency(charges);
  const late = charges.filter((c) => c.status === "vencido").length;
  const next = st.blockers[0] ?? st.tasks[0];
  const rest = st.tasks.filter((t) => t !== next);

  return (
    <>
      <div className="head">
        <div>
          <p className="eyebrow">{formatPeriod(period)} · Paso {Math.min(st.steps.filter((s) => s.complete).length + 1, st.steps.length)} de {st.steps.length}</p>
          <h1>Hola, {store.org.name}</h1>
          <p>{st.closed ? `${formatPeriod(period)} ya está cerrado.` : `Así va ${formatPeriod(period)}.`}</p>
        </div>
        <div className="head-actions"><PeriodPicker period={period} base="/" /><QuickAdd store={store} period={period} hoy={today(store)} /></div>
      </div>

      {next && !st.closed ? (
        <section className="hero">
          <span className="small">Lo próximo para hacer</span>
          <b>{next.title}</b>
          <span>{next.detail}</span>
          <Link className="btn big" href={next.href}>Resolver</Link>
        </section>
      ) : (
        <section className="hero done"><b>{st.closed ? "Mes cerrado." : "No hay nada pendiente."}</b><span>Podés pasar al mes siguiente con la flecha de arriba.</span></section>
      )}

      <Stepper steps={st.steps} period={period} />

      {main && (
        <div className="kpis">
          <div className="kpi"><span>Cobrado</span><b><M m={main.received} /></b></div>
          <div className="kpi"><span>Falta cobrar</span><b><M m={main.pending} /></b></div>
          <div className="kpi"><span>Alquileres atrasados</span><b className="num">{late}</b></div>
        </div>
      )}
      {others.map((t) => (
        <p key={t.currency} className="small muted">En {t.currency === "USD" ? "dólares" : t.currency}: cobrado {formatMoney(t.received)}, falta cobrar {formatMoney(t.pending)}.</p>
      ))}

      {rest.length > 0 && (
        <section className="section">
          <header><h2>Otros pendientes</h2><span className="small muted">{rest.length}</span></header>
          <ul className="tasks">{rest.slice(0, 3).map((t) => <Task key={t.id} t={t} />)}</ul>
          {rest.length > 3 && (
            <details className="more">
              <summary>Ver los {rest.length - 3} restantes</summary>
              <ul className="tasks">{rest.slice(3).map((t) => <Task key={t.id} t={t} />)}</ul>
            </details>
          )}
        </section>
      )}
    </>
  );
}
