import Link from "next/link";
import { notFound } from "next/navigation";
import { adjustmentPeriods, computeAdjustment, explainAdjustment } from "@/lib/domain/adjustments";
import { chargeFor } from "@/lib/domain/charges";
import { describeRounding } from "@/lib/domain/money";
import { addMonths, formatDate, formatPeriod } from "@/lib/domain/period";
import { INDEX_LABEL } from "@/lib/domain/types";
import { getStore, periodFrom, today } from "@/lib/server/store";
import { ChargeChip, M, personName, propertyLabel } from "@/lib/view";

export default async function Contrato({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const store = getStore();
  const period = periodFrom(sp);
  const c = store.contracts.find((x) => x.id === id);
  if (!c) notFound();
  const ch = chargeFor(store, c, period, today());
  const adjPeriods = adjustmentPeriods(c, addMonths(period, 12));
  const history = store.audit.filter((e) => e.entityId === c.id).slice(-15).reverse();

  return (
    <>
      <div className="head">
        <div>
          <Link href={`/contratos?periodo=${period}`} className="small">← Contratos</Link>
          <h1>{c.code} · {propertyLabel(store, c.propertyId)}</h1>
          <p>{c.currency === "USD" ? "Contrato en dólares" : "Contrato en pesos"} · del {formatDate(c.startDate)} al {formatDate(c.endDate)}</p>
        </div>
      </div>

      <section className="section">
        <header><h2>Partes y condiciones</h2></header>
        <div className="body">
          <dl className="kv">
            <dt>Inquilino</dt><dd>{c.tenantIds.map((t) => personName(store, t)).join(", ")}</dd>
            <dt>Propietarios</dt><dd>{c.owners.map((o) => `${personName(store, o.ownerId)} (${o.shareBps / 100}%)`).join(", ")}</dd>
            <dt>Alquiler inicial</dt><dd><M m={c.initialRent} /></dd>
            <dt>Vencimiento</dt><dd>Día {c.dueDay} de cada mes</dd>
            <dt>Comisión</dt><dd>{c.commissionBps / 100}% a cargo del {c.commissionPaidBy}</dd>
            <dt>Punitorios</dt><dd>{c.lateFee ? <>{c.lateFee.dailyRateBps / 100}% diario, {c.lateFee.graceDays} días de gracia. <span className="muted">“{c.lateFee.clauseText}”</span></> : <span className="muted">No hay regla cargada: el sistema no calcula punitorios para este contrato.</span>}</dd>
            {c.guarantee && (<><dt>Garantía</dt><dd>{c.guarantee}</dd></>)}
            {c.notes && (<><dt>Notas</dt><dd>{c.notes}</dd></>)}
          </dl>
        </div>
      </section>

      <section className="section">
        <header><h2>Alquiler de {formatPeriod(period)}</h2><ChargeChip c={ch} /></header>
        <div className="body">
          <dl className="kv">
            <dt>Importe</dt><dd><M m={ch.amount} />{ch.provisional && <span className="missing"> · provisorio: el aumento de este mes no está aprobado</span>}</dd>
            <dt>Vence</dt><dd>{formatDate(ch.dueDate)}</dd>
            <dt>Cobrado y confirmado</dt><dd><M m={ch.confirmed} /></dd>
            {ch.informed.cents > 0 && (<><dt>Informado sin verificar</dt><dd><M m={ch.informed} /></dd></>)}
            <dt>Saldo</dt><dd><M m={ch.balance.cents > 0 ? ch.balance : { cents: 0, currency: c.currency }} /></dd>
            {ch.lateFee && (<><dt>Punitorios calculados</dt><dd><M m={ch.lateFee.amount} /> <span className="muted small">(no se suman al saldo hasta que decidas reclamarlos) {ch.lateFee.explanation}</span></dd></>)}
          </dl>
        </div>
      </section>

      <section className="section" id="aumento">
        <header><h2>Actualizaciones</h2></header>
        <div className="body">
          {!c.adjustment ? <p className="muted">Este contrato no tiene cláusula de actualización cargada.</p> : (
            <>
              <p style={{ margin: 0 }}>{INDEX_LABEL[c.adjustment.index]} cada {c.adjustment.everyMonths} meses, desde {formatPeriod(c.adjustment.firstPeriod)}. Redondeo: {describeRounding(c.adjustment.rounding ?? { mode: "nearest", toCents: 1, fromContract: false })}.</p>
              {c.adjustment.clauseText && <p className="muted" style={{ margin: 0 }}>Cláusula: “{c.adjustment.clauseText}”</p>}
              <div className="tbl">
                <table>
                  <thead><tr><th>Período</th><th>Estado</th><th className="r">Anterior</th><th className="r">Nuevo</th><th>Cálculo</th></tr></thead>
                  <tbody>
                    {adjPeriods.map((p) => {
                      const a = computeAdjustment(store, c, p);
                      const label = a.status === "aprobado" ? "Aprobado" : a.status === "comunicado" ? "Aprobado y comunicado" : a.status === "calculado" ? "Calculado, falta aprobar" : "Pendiente de datos";
                      return (
                        <tr key={p}>
                          <td>{formatPeriod(p)}</td>
                          <td><span className={`chip ${a.approved ? "ok" : a.status === "calculado" ? "info" : "warn"}`}>{label}</span></td>
                          <td className="r"><M m={a.previous} /></td>
                          <td className="r">{a.result ? <M m={a.result} /> : "—"}</td>
                          <td className="small">{explainAdjustment(a) ?? a.missing[0]}{a.approved && <div className="muted">Aprobado por {a.approved.approvedBy}</div>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="small muted">Los aumentos se aprueban desde <Link href={`/cierre?periodo=${period}#preparar`}>Cierre del mes</Link>. Un aumento futuro puede cambiar si el anterior todavía no está aprobado.</p>
            </>
          )}
        </div>
      </section>

      <section className="section">
        <header><h2>Historial</h2></header>
        <div className="body">
          {history.length === 0 ? <p className="muted">Sin cambios registrados para este contrato.</p> : (
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              {history.map((e) => <li key={e.id}>{new Date(e.at).toLocaleString("es-AR")} · {e.actor} {e.action}{e.detail ? ` (${e.detail})` : ""}{e.reason ? `. Motivo: ${e.reason}` : ""}</li>)}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
