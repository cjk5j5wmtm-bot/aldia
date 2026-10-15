import Link from "next/link";
import { chargesFor } from "@/lib/domain/charges";
import { closeStatus } from "@/lib/domain/close";
import { formatPeriod } from "@/lib/domain/period";
import { getStore, periodFrom, today } from "@/lib/server/store";
import { M, PeriodPicker, totalsByCurrency } from "@/lib/view";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const store = getStore();
  const period = periodFrom(sp);
  const st = closeStatus(store, period, today());
  const charges = chargesFor(store, period, today());
  const totals = totalsByCurrency(charges);
  const next = st.blockers[0] ?? st.tasks[0];

  return (
    <>
      <div className="head">
        <div>
          <h1>Inicio</h1>
          <p>{st.closed ? `${formatPeriod(period)} está cerrado.` : `Así va el cierre de ${formatPeriod(period)}.`}</p>
        </div>
        <PeriodPicker period={period} base="/" />
      </div>

      {next && !st.closed && (
        <section className="section">
          <div className="body">
            <span className="small muted">Lo próximo para hacer</span>
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div><b>{next.title}</b><div className="muted small">{next.detail}</div></div>
              <Link className="btn" href={next.href}>Resolver</Link>
            </div>
          </div>
        </section>
      )}

      <div className="steps">
        {st.steps.map((s) => (
          <Link key={s.key} href={`/cierre?periodo=${period}#${s.key}`} className={`step ${s.complete ? "done" : ""}`}>
            <span className="lbl">{s.complete ? "Completo" : "Pendiente"}</span>
            <b>{s.title}</b>
            <span className="bar" aria-hidden="true"><i style={{ width: `${s.total ? (s.done / s.total) * 100 : s.complete ? 100 : 0}%` }} /></span>
            <span className="small muted">{s.summary}</span>
          </Link>
        ))}
      </div>

      <section className="section">
        <header><h2>Necesita atención</h2><span className="small muted">{st.tasks.length} pendientes</span></header>
        <div className="body flush">
          {st.tasks.length === 0 ? (
            <p className="empty">No hay nada pendiente en este período.</p>
          ) : (
            <ul className="tasks">
              {st.tasks.map((t) => (
                <li key={t.id}>
                  <span className={`chip ${t.severity === "bloquea" ? "bad" : "warn"}`}>{t.severity === "bloquea" ? "Bloquea el cierre" : "Revisar"}</span>
                  <div className="t"><b>{t.title}</b><span>{t.detail}</span></div>
                  <Link className="btn ghost" href={t.href}>Ir</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="section">
        <header><h2>Importes del período</h2><Link href={`/cobranzas?periodo=${period}`} className="small">Ver el detalle por contrato</Link></header>
        <div className="body">
          {totals.length === 0 && <p className="muted">No hay contratos activos en este período.</p>}
          {totals.map((t) => (
            <div key={t.currency} className="totals">
              <div className="total"><div className="l">Esperado en {t.currency}</div><div className="v"><M m={t.expected} /></div>{t.provisional && <div className="small missing">Incluye importes provisorios: hay aumentos sin aprobar.</div>}</div>
              <div className="total"><div className="l">Recibido y confirmado</div><div className="v"><M m={t.received} /></div></div>
              <div className="total"><div className="l">Pendiente</div><div className="v"><M m={t.pending} /></div></div>
            </div>
          ))}
          <p className="small muted">Importes de alquiler sin punitorios. Los pagos informados que todavía no verificaste no cuentan como recibidos.</p>
        </div>
      </section>
    </>
  );
}
