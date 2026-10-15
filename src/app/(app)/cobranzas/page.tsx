import Link from "next/link";
import { chargesFor } from "@/lib/domain/charges";
import { formatMoney } from "@/lib/domain/money";
import { formatDate, formatPeriod } from "@/lib/domain/period";
import { reminderDraft } from "@/lib/domain/messages";
import { unallocated } from "@/lib/domain/payments";
import { METHOD_LABEL } from "@/lib/domain/types";
import { periodFrom, requireApp, today } from "@/lib/server/store";
import { ChargeChip, M, personName, propertyLabel } from "@/lib/view";
import { allocateAction, confirmPaymentAction, recordPaymentAction, reverseAllocationAction, voidPaymentAction } from "../../actions";
import { ActionForm, CopyText } from "../../ui";

export default async function Cobranzas({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { store } = await requireApp();
  const period = periodFrom(store, sp);
  const hoy = today(store);
  const filter = typeof sp.estado === "string" ? sp.estado : "todos";
  const ver = sp.ver === "pagos" ? "pagos" : "alquileres";
  const pendingPayments = store.payments.filter((p) => p.status === "informado" || (p.status !== "anulado" && unallocated(p).cents > 0)).length;
  const all = chargesFor(store, period, hoy);
  const charges = all.filter((c) => filter === "todos" || (filter === "deben" ? c.balance.cents > 0 : c.status === "pagado"));
  const open = all.filter((c) => c.balance.cents > 0);
  const payments = [...store.payments].sort((a, b) => (a.status === b.status ? b.effectiveDate.localeCompare(a.effectiveDate) : a.status === "informado" ? -1 : 1));
  const chargeLabel = (key: string) => {
    const [cid, p] = key.split(":");
    const c = store.contracts.find((x) => x.id === cid);
    return `${c?.code ?? cid} · ${formatPeriod(p)}`;
  };

  return (
    <>
      <div className="head">
        <div><h1>Cobranzas</h1><p>{formatPeriod(period)}: {all.length - open.length} de {all.length} alquileres pagados.</p></div>
        <details className="pop">
          <summary className="btn">Registrar un pago</summary>
          <div className="pop-body">
            <p className="small muted" style={{ margin: 0 }}>Cargá un pago que ya ocurrió: Al Día no cobra ni mueve dinero.</p>
            <ActionForm action={recordPaymentAction} submit="Registrar pago" className="stack">
              <input type="hidden" name="period" value={period} />
              <label className="field">¿De quién es?<select name="contractId" defaultValue=""><option value="">No sé todavía</option>{open.map((c) => <option key={c.key} value={c.contract.id}>{c.contract.code} · {personName(store, c.contract.tenantIds[0])} · debe {formatMoney(c.balance)}</option>)}</select></label>
              <div className="row">
                <label className="field">Importe<input name="amount" inputMode="decimal" required placeholder="620.000,00" /></label>
                <label className="field">Moneda<select name="currency"><option value="ARS">Pesos</option><option value="USD">Dólares</option></select></label>
              </div>
              <div className="row">
                <label className="field">Fecha<input type="date" name="date" required defaultValue={hoy} /></label>
                <label className="field">Medio<select name="method">{Object.entries(METHOD_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              </div>
              <details>
                <summary className="small">Más datos (opcional)</summary>
                <label className="field">Número de operación (evita cargarlo dos veces)<input name="reference" /></label>
                <label className="field">Nota<input name="note" placeholder="Ej.: pagó en la oficina" /></label>
              </details>
              <label className="field">¿Ya viste la plata?<select name="verified"><option value="no">Todavía no, me avisaron que pagó</option><option value="si">Sí, está en la cuenta o en mano</option></select></label>
            </ActionForm>
          </div>
        </details>
      </div>
      <nav className="tabs" aria-label="Ver">
        <Link href={`/cobranzas?periodo=${period}`} aria-current={ver === "alquileres" ? "page" : undefined}>Alquileres</Link>
        <Link href={`/cobranzas?periodo=${period}&ver=pagos`} aria-current={ver === "pagos" ? "page" : undefined}>Pagos recibidos{pendingPayments ? <span className="badge">{pendingPayments}</span> : null}</Link>
      </nav>

      {ver === "alquileres" && <section className="section">
        <header>
          <div className="period">
            {[["todos", "Todos"], ["deben", "Deben"], ["pagados", "Pagados"]].map(([k, l]) => (
              k === filter ? <span key={k}>{l}</span> : <Link key={k} href={`/cobranzas?periodo=${period}&estado=${k}`}>{l}</Link>
            ))}
          </div>
        </header>
        <div className="body flush tbl">
          {charges.length === 0 ? <p className="empty">No hay alquileres en este filtro.</p> : (
            <table>
              <thead><tr><th>Inquilino</th><th className="r">Debe</th><th>Estado</th><th>Recordatorio</th></tr></thead>
              <tbody>
                {charges.map((ch) => {
                  const draft = reminderDraft(store, ch);
                  return (
                    <tr key={ch.key}>
                      <td><b>{ch.contract.tenantIds.map((t) => personName(store, t)).join(", ")}</b><div className="small muted"><Link href={`/contratos/${ch.contract.id}?periodo=${period}`}>{ch.contract.code}</Link> · {propertyLabel(store, ch.contract.propertyId)}</div></td>
                      <td className="r"><M m={ch.balance.cents > 0 ? ch.balance : { cents: 0, currency: ch.contract.currency }} />{ch.informed.cents > 0 && <div className="small muted">{formatMoney(ch.informed)} informado</div>}{ch.provisional && <div className="small missing">provisorio</div>}{ch.lateFee && <div className="small muted" title={ch.lateFee.explanation}>+ {formatMoney(ch.lateFee.amount)} punitorios calculados</div>}</td>
                      <td><ChargeChip c={ch} /><div className="small muted">vence {formatDate(ch.dueDate)}</div></td>
                      <td>
                        {ch.balance.cents > 0 ? (
                          <details>
                            <summary>Armar mensaje</summary>
                            {draft.warnings.map((w) => <p key={w} className="small missing">{w}</p>)}
                            <CopyText text={draft.text} />
                            <p className="small muted">El envío automático por WhatsApp no está configurado. Copiá el texto y mandalo desde tu teléfono{draft.phone ? ` al ${draft.phone}` : ""}.</p>
                          </details>
                        ) : <span className="small muted">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>}

      {ver === "pagos" && <section className="section" id="pagos">
        <header><h2>Pagos</h2><span className="small muted">Los informados no cuentan como cobrados hasta que los confirmes.</span></header>
        <div className="body">
          {payments.length === 0 && <p className="muted">Todavía no hay pagos registrados.</p>}
          {payments.map((p) => {
            const left = unallocated(p);
            const candidates = open.filter((c) => c.contract.currency === p.amount.currency);
            const match = candidates.find((c) => c.balance.cents === left.cents);
            return (
              <div key={p.id} className="calc">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <b><M m={p.amount} /> · {METHOD_LABEL[p.method]} · {formatDate(p.effectiveDate)}</b>
                  <span className={`chip ${p.status === "confirmado" ? "ok" : p.status === "informado" ? "warn" : "info"}`}>{p.status === "confirmado" ? "Verificado" : p.status === "informado" ? "Informado, sin verificar" : "Anulado"}</span>
                </div>
                <div className="muted">{p.reference ? `Ref. ${p.reference} · ` : ""}{p.payerNote ? `${p.payerNote} · ` : ""}cargado por {p.recordedBy}</div>
                {p.allocations.map((a) => (
                  <div key={a.id} className="row" style={{ alignItems: "center" }}>
                    <span>{a.reversed ? <s>{chargeLabel(a.chargeKey)}: {formatMoney(a.amount)}</s> : <>{chargeLabel(a.chargeKey)}: <M m={a.amount} /></>}</span>
                    {a.reversed ? <span className="small muted">Revertida: {a.reversed.reason}</span> : p.status !== "anulado" && (
                      <details><summary className="small">Revertir</summary>
                        <ActionForm action={reverseAllocationAction} submit="Revertir asignación" variant="ghost">
                          <input type="hidden" name="paymentId" value={p.id} /><input type="hidden" name="allocationId" value={a.id} />
                          <label className="field">Motivo<input name="reason" required /></label>
                        </ActionForm>
                      </details>
                    )}
                  </div>
                ))}
                {p.status !== "anulado" && left.cents > 0 && (
                  <>
                    <div className="missing">Sin asignar: {formatMoney(left)}{match ? `. Coincide con el saldo de ${match.contract.code}.` : ""}</div>
                    {candidates.length > 0 && (
                      <ActionForm action={allocateAction} submit="Asignar" variant="ghost">
                        <input type="hidden" name="paymentId" value={p.id} />
                        <label className="field">Alquiler<select name="chargeKey" defaultValue={match?.key ?? ""}><option value="" disabled>Elegí uno</option>{candidates.map((c) => <option key={c.key} value={c.key}>{c.contract.code} · {personName(store, c.contract.tenantIds[0])} · saldo {formatMoney(c.balance)}</option>)}</select></label>
                        <label className="field">Importe<input name="amount" defaultValue={(Math.min(left.cents, match?.balance.cents ?? left.cents) / 100).toFixed(2).replace(".", ",")} /></label>
                      </ActionForm>
                    )}
                  </>
                )}
                {p.status === "informado" && (
                  <div className="row">
                    <ActionForm action={confirmPaymentAction} submit="Confirmar: la plata está en la cuenta"><input type="hidden" name="paymentId" value={p.id} /></ActionForm>
                  </div>
                )}
                {p.status !== "anulado" && p.allocations.every((a) => a.reversed) && (
                  <details><summary className="small">Anular este pago</summary>
                    <ActionForm action={voidPaymentAction} submit="Anular pago" variant="danger" confirm="¿Anular el pago? Queda en el historial como anulado.">
                      <input type="hidden" name="paymentId" value={p.id} />
                      <label className="field">Motivo<input name="reason" required /></label>
                    </ActionForm>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </section>}
    </>
  );
}
