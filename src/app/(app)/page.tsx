import Link from "next/link";
import { QuickAdd } from "./quick-add";
import { hideItemAction, showItemAction } from "../actions";
import { IconAction } from "../ui";
import { isHidden, taskKey } from "@/lib/domain/hidden";
import { chargesFor } from "@/lib/domain/charges";
import { closeStatus, type Task as CloseTask } from "@/lib/domain/close";
import { formatMoney } from "@/lib/domain/money";
import { formatPeriod } from "@/lib/domain/period";
import { periodFrom, requireApp, today } from "@/lib/server/store";
import { M, PeriodPicker, totalsByCurrency } from "@/lib/view";

const Task = ({ t, period, hidden, next }: { t: CloseTask; period: string; hidden?: boolean; next?: boolean }) => (
  <li className={next ? "next" : undefined}>
    <span className={`sev ${hidden ? "off" : t.severity}`} aria-label={t.severity === "bloquea" ? "Frena el cierre" : "Para revisar"} />
    <div className="t"><b>{t.title}</b><span>{t.detail}</span></div>
    <div className="row-actions">
      {hidden ? (
        <IconAction action={showItemAction} fields={{ key: taskKey(period, t.id) }} label="Volver a mostrar" kind="restore" />
      ) : (
        <>
          <Link className={next ? "btn" : "btn ghost"} href={t.href}>Resolver</Link>
          <IconAction action={hideItemAction} fields={{ key: taskKey(period, t.id) }} label="Quitar de pendientes"
            confirm="¿Quitarlo de tus pendientes? No se resuelve: el cierre del mes lo sigue contando." />
        </>
      )}
    </div>
  </li>
);

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { store } = await requireApp();
  const period = periodFrom(store, sp);
  const hoy = today(store);
  const st = closeStatus(store, period, hoy);
  const charges = chargesFor(store, period, hoy);
  const [main, ...others] = totalsByCurrency(charges);
  const late = charges.filter((c) => c.status === "vencido").length;
  const shown = st.tasks.filter((t) => !isHidden(store, taskKey(period, t.id)));
  const hiddenTasks = st.tasks.filter((t) => isHidden(store, taskKey(period, t.id)));
  // Primero lo que frena el cierre, después lo que conviene revisar. Dentro de cada grupo, en el orden de las etapas.
  const ordered = [...shown.filter((t) => t.severity === "bloquea"), ...shown.filter((t) => t.severity !== "bloquea")];
  const doneSteps = st.steps.filter((s) => s.complete).length;
  const current = st.steps.find((s) => !s.complete);

  return (
    <>
      <div className="head">
        <div>
          <h1>Hola, {store.org.name}</h1>
          <p>{st.closed ? `${formatPeriod(period)} está cerrado.` : `Así va ${formatPeriod(period)}.`}</p>
        </div>
        <div className="head-actions"><PeriodPicker period={period} base="/" /><QuickAdd store={store} period={period} hoy={hoy} /></div>
      </div>

      {main && (
        <div className="kpis">
          <div className="kpi">
            <span>Cobrado</span>
            <b><M m={main.received} /></b>
            <small>Pagos verificados de {formatPeriod(period)}</small>
          </div>
          <div className="kpi">
            <span>Falta cobrar</span>
            <b><M m={main.pending} /></b>
            <small>{main.provisional ? "Incluye alquileres con aumento sin aprobar" : "Saldo de los alquileres del mes"}</small>
          </div>
          <div className={`kpi ${shown.length ? "alert" : ""}`}>
            <span>Requieren atención</span>
            <b className="num">{shown.length}</b>
            <small>{late ? `${late} alquiler${late === 1 ? "" : "es"} vencido${late === 1 ? "" : "s"}` : "Ningún alquiler vencido"}</small>
          </div>
        </div>
      )}
      {others.map((t) => (
        <p key={t.currency} className="small muted" style={{ marginTop: 8 }}>En dólares: cobrado {formatMoney(t.received)}, falta cobrar {formatMoney(t.pending)}.</p>
      ))}

      <div className="progress" aria-label="Avance del cierre">
        <span><b>Cierre de {formatPeriod(period)}</b> <span className="muted">· {st.closed ? "cerrado" : `${doneSteps} de ${st.steps.length} etapas completas`}</span></span>
        <span className="progress-bar" aria-hidden="true">{st.steps.map((s) => <i key={s.key} className={s.complete ? "on" : s === current ? "now" : ""} />)}</span>
        <Link href={`/cierre?periodo=${period}`} className="small">{current && !st.closed ? `Seguir: ${current.title.toLowerCase()}` : "Ver el cierre"}</Link>
      </div>

      <div className="section-title">
        <h2>Pendientes</h2>
        {ordered.length > 0 && <span className="small muted">{ordered.length}</span>}
      </div>
      <section className="section">
        {st.closed ? (
          <div className="empty-state"><b>El mes está cerrado.</b><span className="muted small">Pasá al mes siguiente con la flecha de arriba.</span></div>
        ) : ordered.length === 0 ? (
          <div className="empty-state"><b>No tenés pendientes.</b><span className="muted small">{hiddenTasks.length ? `Quitaste ${hiddenTasks.length} de la lista; están abajo y siguen sin resolver.` : "Cuando haya algo para hacer, aparece acá."}</span></div>
        ) : (
          <>
            <ul className="tasks">{ordered.slice(0, 6).map((t, i) => <Task key={t.id} t={t} period={period} next={i === 0} />)}</ul>
            {ordered.length > 6 && (
              <details className="more">
                <summary>Ver los {ordered.length - 6} restantes</summary>
                <ul className="tasks">{ordered.slice(6).map((t) => <Task key={t.id} t={t} period={period} />)}</ul>
              </details>
            )}
          </>
        )}
      </section>

      {hiddenTasks.length > 0 && (
        <details className="section">
          <summary>Quitados de la lista ({hiddenTasks.length})</summary>
          <ul className="tasks">{hiddenTasks.map((t) => <Task key={t.id} t={t} period={period} hidden />)}</ul>
        </details>
      )}
    </>
  );
}
