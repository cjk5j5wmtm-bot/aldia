import Link from "next/link";
import { chargesFor } from "@/lib/domain/charges";
import { formatMoney } from "@/lib/domain/money";
import { formatDate, formatPeriod } from "@/lib/domain/period";
import { reminderDraft } from "@/lib/domain/messages";
import { unallocated } from "@/lib/domain/payments";
import { METHOD_LABEL } from "@/lib/domain/types";
import { periodFrom, requireApp, today } from "@/lib/server/store";
import { ChargeChip, M, PeriodPicker, personName, propertyLabel } from "@/lib/view";
import { isHidden, paymentKey } from "@/lib/domain/hidden";
import { allocateAction, clearChargesAction, hideItemAction, confirmPaymentAction, restoreChargesAction, reverseAllocationAction } from "../../actions";
import { ActionForm, CopyText, IconAction } from "../../ui";
import { QuickAdd } from "../quick-add";

export default async function Cobranzas({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { store } = await requireApp();
  const period = periodFrom(store, sp);
  const hoy = today(store);
  const prof = store.org.profile;
  const debtorsFirst = Boolean(prof && (prof.pains.includes("cobrar") || prof.late !== "pocos"));
  const filter = typeof sp.estado === "string" ? sp.estado : debtorsFirst ? "deben" : "todos";
  const ver = sp.ver === "pagos" ? "pagos" : "alquileres";
  const pendingPayments = store.payments.filter((p) => p.status === "informado" || (p.status !== "anulado" && unallocated(p).cents > 0)).length;
  const all = chargesFor(store, period, hoy);
  const cleared = new Set(store.clearedCharges ?? []);
  const visible = all.filter((c) => !cleared.has(c.key));
  const hidden = all.filter((c) => cleared.has(c.key));
  const paidVisible = visible.filter((c) => c.status === "pagado").length;
  const charges = filter === "quitados" ? hidden : visible.filter((c) => filter === "todos" || (filter === "deben" ? c.balance.cents > 0 : c.status === "pagado"));
  const open = all.filter((c) => c.balance.cents > 0);
  const payments = [...store.payments].sort((a, b) => (a.status === b.status ? b.effectiveDate.localeCompare(a.effectiveDate) : a.status === "informado" ? -1 : 1));
  const shownPayments = payments.filter((p) => !isHidden(store, paymentKey(p.id)));
  const hiddenPayments = payments.filter((p) => isHidden(store, paymentKey(p.id)));
  const chargeLabel = (key: string) => {
    const [cid, p] = key.split(":");
    const c = store.contracts.find((x) => x.id === cid);
    return `${c?.code ?? cid} · ${formatPeriod(p)}`;
  };

  return (
    <>
      <div className="head">
        <div><h1>Cobranzas</h1><p>{formatPeriod(period)}: {all.length - open.length} de {all.length} alquileres pagados.</p></div>
        <div className="head-actions"><PeriodPicker period={period} base={`/cobranzas?ver=${ver}`} /><QuickAdd store={store} period={period} hoy={hoy} /></div>
      </div>
      <nav className="tabs" aria-label="Ver">
        <Link href={`/cobranzas?periodo=${period}`} aria-current={ver === "alquileres" ? "page" : undefined}>Alquileres</Link>
        <Link href={`/cobranzas?periodo=${period}&ver=pagos`} aria-current={ver === "pagos" ? "page" : undefined}>Pagos recibidos{pendingPayments ? <span className="badge">{pendingPayments}</span> : null}</Link>
      </nav>

      {ver === "alquileres" && debtorsFirst && typeof sp.estado !== "string" && (
        <p className="focus-note">Como nos contaste que cobrar te cuesta, te mostramos primero a los que deben. En cada uno tenés el recordatorio de WhatsApp listo para copiar.</p>
      )}
      {ver === "alquileres" && <section className="section">
        <header>
          <div className="seg" role="group" aria-label="Filtrar">
            {[["todos", "Todos"], ["deben", "Deben"], ["pagados", "Pagados"], ...(hidden.length ? [["quitados", `Quitados (${hidden.length})`]] : [])].map(([k, l]) => (
              k === filter ? <span key={k} aria-current="true">{l}</span> : <Link key={k} href={`/cobranzas?periodo=${period}&estado=${k}`}>{l}</Link>
            ))}
          </div>
          {filter !== "quitados" && paidVisible > 0 && (
            <ActionForm action={clearChargesAction} submit={`Quitar los pagados (${paidVisible})`} variant="ghost" confirm={`¿Sacar de la lista los ${paidVisible} alquileres pagados? Los pagos siguen registrados.`}>
              <input type="hidden" name="period" value={period} />
            </ActionForm>
          )}
        </header>
        <div className="body flush tbl">
          {charges.length === 0 ? <p className="empty">{filter === "pagados" && hidden.length ? "Los pagados de este mes ya los sacaste de la lista. Están en \"Quitados\"." : "No hay alquileres en este filtro."}</p> : (
            <table className="cards">
              <thead><tr><th>Inquilino</th><th>Estado</th><th className="r">Debe</th><th className="act"><span className="sr">Acciones</span></th></tr></thead>
              <tbody>
                {charges.map((ch) => {
                  const draft = reminderDraft(store, ch);
                  const owes = ch.balance.cents > 0;
                  return (
                    <tr key={ch.key}>
                      <td><b style={{ fontWeight: 500 }}>{ch.contract.tenantIds.map((t) => personName(store, t)).join(", ")}</b><div className="small muted"><Link href={`/contratos/${ch.contract.id}?periodo=${period}`}>{ch.contract.code}</Link> · {propertyLabel(store, ch.contract.propertyId)}</div></td>
                      <td><ChargeChip c={ch} /><div className="small muted">vence {formatDate(ch.dueDate)}</div></td>
                      <td className="r"><M m={owes ? ch.balance : { cents: 0, currency: ch.contract.currency }} />{ch.informed.cents > 0 && <div className="small muted">{formatMoney(ch.informed)} informado</div>}{ch.provisional && <div className="small missing">provisorio</div>}{ch.lateFee && <div className="small muted" title={ch.lateFee.explanation}>+ {formatMoney(ch.lateFee.amount)} punitorios calculados</div>}</td>
                      <td className="act">
                        <div className="row-actions">
                          {owes && !cleared.has(ch.key) && (
                            <details>
                              <summary className="small">Recordatorio</summary>
                              {draft.warnings.map((w) => <p key={w} className="small missing">{w}</p>)}
                              <CopyText text={draft.text} />
                              <p className="small muted">Copiá el texto y mandalo por WhatsApp desde tu teléfono{draft.phone ? ` al ${draft.phone}` : ""}.</p>
                            </details>
                          )}
                          {cleared.has(ch.key) ? (
                            <IconAction action={restoreChargesAction} fields={{ key: ch.key }} label="Volver a mostrar" kind="restore" />
                          ) : (
                            <IconAction action={clearChargesAction} fields={{ key: ch.key, period }} label="Borrar de la lista"
                              confirm={owes ? `¿Borrar a ${personName(store, ch.contract.tenantIds[0])} de la lista? Todavía debe ${formatMoney(ch.balance)}: va a seguir contando en "Falta cobrar" hasta que registres el pago.` : undefined} />
                          )}
                        </div>
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
          {payments.length > 0 && shownPayments.length === 0 && <p className="muted">No quedan pagos en la lista. Los borrados están abajo.</p>}
          {shownPayments.map((p) => {
            const left = unallocated(p);
            const candidates = open.filter((c) => c.contract.currency === p.amount.currency);
            const match = candidates.find((c) => c.balance.cents === left.cents);
            return (
              <div key={p.id} className="calc">
                <div className="calc-head">
                  <b><M m={p.amount} /> · {METHOD_LABEL[p.method]} · {formatDate(p.effectiveDate)}</b>
                  <div className="row-actions">
                    <span className={`chip ${p.status === "confirmado" ? "ok" : p.status === "informado" ? "warn" : "info"}`}>{p.status === "confirmado" ? "Verificado" : p.status === "informado" ? "Informado, sin verificar" : "Anulado"}</span>
                    <IconAction action={hideItemAction} fields={{ key: paymentKey(p.id) }} label="Borrar pago"
                      confirm={p.status === "anulado" ? undefined : `¿Borrar este pago de ${formatMoney(p.amount)}? ${p.allocations.some((a) => !a.reversed) ? "El alquiler al que estaba asignado vuelve a figurar como impago. " : ""}Queda registrado en el historial.`} />
                  </div>
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
              </div>
            );
          })}
          {hiddenPayments.length > 0 && (
            <details>
              <summary>Borrados ({hiddenPayments.length})</summary>
              <div className="hidden-list">
                {hiddenPayments.map((p) => (
                  <div key={p.id} className="calc row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <span><M m={p.amount} /> · {METHOD_LABEL[p.method]} · {formatDate(p.effectiveDate)} · borrado</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </section>}
    </>
  );
}
