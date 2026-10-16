import Link from "next/link";
import { QuickAdd } from "./quick-add";
import { hideItemAction, showItemAction } from "../actions";
import { ActionForm } from "../ui";
import { isHidden, taskKey } from "@/lib/domain/hidden";
import { chargesFor } from "@/lib/domain/charges";
import { closeStatus, type Task as CloseTask } from "@/lib/domain/close";
import { formatMoney } from "@/lib/domain/money";
import { formatPeriod } from "@/lib/domain/period";
import { periodFrom, requireApp, today } from "@/lib/server/store";
import { M, PeriodPicker, Stepper, totalsByCurrency } from "@/lib/view";

const Task = ({ t, period, hidden }: { t: CloseTask; period: string; hidden?: boolean }) => (
  <li>
    <div className="t"><b>{t.title}</b><span>{t.detail}</span></div>
    <div className="row-actions">
      {!hidden && <Link className="btn ghost" href={t.href}>Ir</Link>}
      <ActionForm action={hidden ? showItemAction : hideItemAction} submit={hidden ? "Volver a mostrar" : "✕"} variant="ghost"
        confirm={hidden ? undefined : "¿Sacarlo de tus pendientes? No se resuelve: el cierre del mes lo sigue contando. Podés volver a verlo abajo, en \"Ocultos\"."}>
        <input type="hidden" name="key" value={taskKey(period, t.id)} />
      </ActionForm>
    </div>
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
  const shown = st.tasks.filter((t) => !isHidden(store, taskKey(period, t.id)));
  const hiddenTasks = st.tasks.filter((t) => isHidden(store, taskKey(period, t.id)));
  const next = shown.find((t) => t.severity === "bloquea") ?? shown[0];
  const rest = shown.filter((t) => t !== next);

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
          <div className="row-actions">
            <Link className="btn big" href={next.href}>Resolver</Link>
            <ActionForm action={hideItemAction} submit="Ocultar" variant="ghost" confirm="¿Sacarlo de tus pendientes? No se resuelve: el cierre del mes lo sigue contando.">
              <input type="hidden" name="key" value={taskKey(period, next.id)} />
            </ActionForm>
          </div>
        </section>
      ) : (
        <section className="hero done">
          <b>{st.closed ? "Mes cerrado." : hiddenTasks.length ? "No te quedan pendientes a la vista." : "No hay nada pendiente."}</b>
          <span>{!st.closed && hiddenTasks.length ? `Tenés ${hiddenTasks.length} oculto${hiddenTasks.length === 1 ? "" : "s"} más abajo: siguen sin resolver y el cierre los cuenta.` : "Podés pasar al mes siguiente con la flecha de arriba."}</span>
        </section>
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
          <ul className="tasks">{rest.slice(0, 3).map((t) => <Task key={t.id} t={t} period={period} />)}</ul>
          {rest.length > 3 && (
            <details className="more">
              <summary>Ver los {rest.length - 3} restantes</summary>
              <ul className="tasks">{rest.slice(3).map((t) => <Task key={t.id} t={t} period={period} />)}</ul>
            </details>
          )}
        </section>
      )}
      {hiddenTasks.length > 0 && (
        <details className="section more">
          <summary>Ocultos ({hiddenTasks.length})</summary>
          <ul className="tasks">{hiddenTasks.map((t) => <Task key={t.id} t={t} period={period} hidden />)}</ul>
        </details>
      )}
    </>
  );
}
