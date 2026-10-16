import { ownerSummaryDraft } from "@/lib/domain/messages";
import { formatDate, formatPeriod } from "@/lib/domain/period";
import { computeSettlement, findSettlement, ownersWithContracts, settlementLabel } from "@/lib/domain/settlements";
import { periodFrom, requireApp, today } from "@/lib/server/store";
import { M, PeriodPicker, personName } from "@/lib/view";
import { isHidden, settlementKey } from "@/lib/domain/hidden";
import { approveSettlementAction, hideItemAction, informSettlementAction, showItemAction, transferAction } from "../../actions";
import { ActionForm, CopyText } from "../../ui";
import { QuickAdd } from "../quick-add";

export default async function Propietarios({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { store } = await requireApp();
  const period = periodFrom(store, sp);
  const hoy = today(store);
  const all = ownersWithContracts(store, period);
  const hiddenRec = (o: { ownerId: string; currency: string }) => {
    const r = findSettlement(store, o.ownerId, period, o.currency as never);
    return r && isHidden(store, settlementKey(r.id)) ? r : undefined;
  };
  const list = all.filter((o) => !hiddenRec(o));
  const hidden = all.filter((o) => hiddenRec(o));

  return (
    <>
      <div className="head">
        <div><h1>Propietarios</h1><p>Cuánto le toca a cada dueño en {formatPeriod(period)}.</p></div>
        <div className="head-actions"><PeriodPicker period={period} base="/propietarios" /><QuickAdd store={store} period={period} hoy={hoy} /></div>
      </div>
      {all.length === 0 && <p className="muted">No hay propietarios con contratos activos en este período.</p>}
      {all.length > 0 && list.length === 0 && <p className="muted">Ya sacaste todas las liquidaciones de este mes de la lista. Están abajo, en "Quitadas".</p>}
      {list.map(({ ownerId, currency }) => {
        const rec = findSettlement(store, ownerId, period, currency);
        const s = rec ? rec.snapshot : computeSettlement(store, ownerId, period, currency, hoy);
        const draft = ownerSummaryDraft(store, s, !!rec);
        return (
          <section className="section" id={ownerId} key={`${ownerId}:${currency}`}>
            <header>
              <h2>{personName(store, ownerId)} · {currency}</h2>
              <span className={`chip ${rec ? "ok" : s.blockers.length ? "warn" : "info"}`}>{settlementLabel(rec)}{!rec && s.blockers.length ? ", con pendientes" : ""}</span>
            </header>
            <div className="body">
              <div className="big-line">Le corresponden <b><M m={s.net} /></b></div>
              <span className="small muted">Cobrado <M m={s.collected} />, menos comisión <M m={s.commission} /> y gastos <M m={s.expenses} />.</span>
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
              {!rec && s.blockers.map((b) => <div key={b} className="missing">{b}</div>)}
              {!rec && (
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
                  <p className="small muted">Al Día no transfiere dinero. Esto solo deja constancia de una transferencia que hiciste desde tu banco.</p>
                  <ActionForm action={transferAction} submit="Registrar transferencia">
                    <input type="hidden" name="id" value={rec.id} />
                    <label className="field">Fecha<input type="date" name="date" defaultValue={hoy} required /></label>
                    <label className="field">Número de operación<input name="reference" required /></label>
                  </ActionForm>
                </details>
              )}
              {rec?.externalTransfer && <p style={{ margin: 0 }}>Transferencia registrada: {formatDate(rec.externalTransfer.date)}, operación {rec.externalTransfer.reference}.</p>}
              {rec?.status === "pago_registrado" && (
                <ActionForm action={hideItemAction} submit="✕ Quitar de la lista" variant="ghost"><input type="hidden" name="key" value={settlementKey(rec.id)} /></ActionForm>
              )}
            </div>
          </section>
        );
      })}
      {hidden.length > 0 && (
        <details className="section more">
          <summary>Quitadas ({hidden.length})</summary>
          <div className="body hidden-list">
            {hidden.map((o) => {
              const r = hiddenRec(o)!;
              return (
                <div key={r.id} className="calc row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <span>{personName(store, o.ownerId)} · {o.currency} · <M m={r.snapshot.net} /> · transferencia registrada</span>
                  <ActionForm action={showItemAction} submit="Volver a mostrar" variant="ghost"><input type="hidden" name="key" value={settlementKey(r.id)} /></ActionForm>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </>
  );
}
