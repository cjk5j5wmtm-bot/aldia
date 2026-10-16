import { ownerSummaryDraft } from "@/lib/domain/messages";
import { formatDate, formatPeriod } from "@/lib/domain/period";
import { computeSettlement, findSettlement, ownersWithContracts, settlementLabel } from "@/lib/domain/settlements";
import { periodFrom, requireApp, today } from "@/lib/server/store";
import { M, PeriodPicker, personName } from "@/lib/view";
import { isHidden, ownerKey, settlementKey } from "@/lib/domain/hidden";
import { approveSettlementAction, hideItemAction, informSettlementAction, showItemAction, transferAction } from "../../actions";
import { ActionForm, CopyText, IconAction } from "../../ui";
import { QuickAdd } from "../quick-add";

export default async function Propietarios({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { store } = await requireApp();
  const period = periodFrom(store, sp);
  const hoy = today(store);
  const all = ownersWithContracts(store, period);
  // Clave con la que se ocultó (la vieja de liquidación o la de propietario del mes), para poder volver a mostrarlo.
  const hiddenKey = (o: { ownerId: string; currency: string }) => {
    const r = findSettlement(store, o.ownerId, period, o.currency as never);
    if (r && isHidden(store, settlementKey(r.id))) return settlementKey(r.id);
    const k = ownerKey(period, o.ownerId, o.currency);
    return isHidden(store, k) ? k : undefined;
  };
  const list = all.filter((o) => !hiddenKey(o));
  const hidden = all.filter((o) => hiddenKey(o));

  return (
    <>
      <div className="head">
        <div><h1>Propietarios</h1><p>Cuánto le toca a cada dueño en {formatPeriod(period)}.</p></div>
        <div className="head-actions"><PeriodPicker period={period} base="/propietarios" /><QuickAdd store={store} period={period} hoy={hoy} /></div>
      </div>
      {all.length === 0 && <p className="muted">No hay propietarios con contratos activos en este período.</p>}
      {all.length > 0 && list.length === 0 && <p className="muted">Sacaste a todos los propietarios de la lista de este mes. Están abajo, en "Quitados".</p>}
      {list.map(({ ownerId, currency }) => {
        const rec = findSettlement(store, ownerId, period, currency);
        const s = rec ? rec.snapshot : computeSettlement(store, ownerId, period, currency, hoy);
        const draft = ownerSummaryDraft(store, s, !!rec);
        return (
          <section className="section" id={ownerId} key={`${ownerId}:${currency}`}>
            <header>
              <h2>{personName(store, ownerId)} · {currency}</h2>
              <div className="row-actions">
                <span className={`chip ${rec ? "ok" : s.blockers.length ? "warn" : "info"}`}>{settlementLabel(rec)}{!rec && s.blockers.length ? ", con pendientes" : ""}</span>
                <IconAction action={hideItemAction} fields={{ key: ownerKey(period, ownerId, currency) }} label="Quitar de la lista"
                  confirm={rec?.status === "pago_registrado"
                    ? `¿Quitar a ${personName(store, ownerId)} de la lista de ${formatPeriod(period)}? La liquidación queda guardada.`
                    : `¿Quitar a ${personName(store, ownerId)} de la lista de ${formatPeriod(period)}? No se borra nada: el cierre del mes lo sigue contando hasta que registres la transferencia.`} />
              </div>
            </header>
            <div className="body">
              <div className="breakdown">
                <div><span>Cobrado</span><b><M m={s.collected} /></b></div>
                <div><span>Comisión</span><b>−<M m={s.commission} /></b></div>
                <div><span>Gastos</span><b>−<M m={s.expenses} /></b></div>
                <div><span>Neto para el dueño</span><b><M m={s.net} /></b></div>
              </div>
            </div>
            <details className="more">
            <summary>Ver el detalle por contrato</summary>
            <div className="body flush tbl">
              <table>
                <thead><tr><th>Contrato</th><th className="r">Cobrado</th><th className="r">Comisión</th><th className="r">Gastos</th><th className="r">Neto</th></tr></thead>
                <tbody>
                  {s.lines.map((l) => {
                    const exp = l.expenses.reduce((a, e) => a + e.amount.cents, 0);
                    return (
                      <tr key={l.contractId}>
                        <td><b>{l.contractCode}</b>{l.shareBps !== 10000 && <span className="small muted"> · su parte: {l.shareBps / 100}%</span>}{l.expenses.map((e) => <div key={e.id} className="small muted">{e.description}</div>)}</td>
                        <td className="r"><M m={l.collected} /></td>
                        <td className="r">−<M m={l.commission} /></td>
                        <td className="r">−<M m={{ cents: exp, currency }} /></td>
                        <td className="r"><M m={{ cents: l.collected.cents - l.commission.cents - exp, currency }} /></td>
                      </tr>
                    );
                  })}
                  <tr><td><b>Total</b></td><td className="r"><b><M m={s.collected} /></b></td><td className="r">−<M m={s.commission} /></td><td className="r">−<M m={s.expenses} /></td><td className="r"><b><M m={s.net} /></b></td></tr>
                </tbody>
              </table>
            </div>
            </details>
            <div className="body">
              <p className="small muted" style={{ margin: 0 }}>Calculado solo con pagos verificados y gastos confirmados de {formatPeriod(period)}.{rec ? ` Aprobada por ${rec.approvedBy} el ${formatDate(rec.approvedAt.slice(0, 10))}: este detalle quedó guardado y no cambia.` : ""}</p>
              {!rec && s.blockers.length > 0 && <p className="small" style={{ fontWeight: 500 }}>Antes de aprobar, falta resolver:</p>}
              {!rec && s.blockers.map((b) => <div key={b} className="missing">• {b}</div>)}
              {!rec && s.blockers.length > 0 && <p className="small muted">El botón para aprobar aparece cuando esté todo resuelto.</p>}
              {!rec && s.blockers.length === 0 && (
                <ActionForm action={approveSettlementAction} submit="Aprobar liquidación" confirm="¿Aprobar? El detalle queda guardado tal como está ahora.">
                  <input type="hidden" name="ownerId" value={ownerId} /><input type="hidden" name="period" value={period} /><input type="hidden" name="currency" value={currency} />
                </ActionForm>
              )}
              {rec && (
                <details>
                  <summary>Resumen para el propietario</summary>
                  {draft.warnings.map((w) => <p key={w} className="small missing">{w}</p>)}
                  <CopyText text={draft.text} />
                  {rec.status === "aprobada" && (
                    <ActionForm action={informSettlementAction} submit="Ya se lo mandé" variant="ghost"><input type="hidden" name="id" value={rec.id} /></ActionForm>
                  )}
                </details>
              )}
              {rec && rec.status !== "pago_registrado" && (
                <details>
                  <summary>Registrar la transferencia que hiciste</summary>
                  <p className="small muted">Aldia no transfiere dinero. Esto solo deja constancia de una transferencia que hiciste desde tu banco.</p>
                  <ActionForm action={transferAction} submit="Registrar transferencia">
                    <input type="hidden" name="id" value={rec.id} />
                    <label className="field">Fecha<input type="date" name="date" defaultValue={hoy} required /></label>
                    <label className="field">Número de operación<input name="reference" required /></label>
                  </ActionForm>
                </details>
              )}
              {rec?.externalTransfer && <p style={{ margin: 0 }}>Transferencia registrada: {formatDate(rec.externalTransfer.date)}, operación {rec.externalTransfer.reference}.</p>}

            </div>
          </section>
        );
      })}
      {hidden.length > 0 && (
        <details className="section more">
          <summary>Quitados ({hidden.length})</summary>
          <div className="body hidden-list">
            {hidden.map((o) => {
              const k = hiddenKey(o)!;
              const r = findSettlement(store, o.ownerId, period, o.currency);
              return (
                <div key={k} className="calc row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <span>{personName(store, o.ownerId)} · {o.currency}{r ? <> · <M m={r.snapshot.net} /></> : null} · {settlementLabel(r).toLowerCase()}</span>
                  <IconAction action={showItemAction} fields={{ key: k }} label="Volver a mostrar" kind="restore" />
                </div>
              );
            })}
          </div>
        </details>
      )}
    </>
  );
}
