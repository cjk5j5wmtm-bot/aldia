import { indexMismatches } from "@/lib/domain/profile";
import Link from "next/link";
import { adjustmentPeriods, computeAdjustment, explainAdjustment } from "@/lib/domain/adjustments";
import { contractCoversPeriod } from "@/lib/domain/charges";
import { closeStatus } from "@/lib/domain/close";
import { describeRounding, formatMoney } from "@/lib/domain/money";
import { formatDate, formatPeriod } from "@/lib/domain/period";
import { INDEX_LABEL } from "@/lib/domain/types";
import { periodFrom, requireApp, today } from "@/lib/server/store";
import { M, PeriodPicker, propertyLabel, Stepper } from "@/lib/view";
import { addExpenseAction, approveAdjustmentAction, closePeriodAction, confirmExpenseAction, discardExpenseAction, loadIndexAction, setLagAction } from "../../actions";
import { ActionForm } from "../../ui";
import { QuickAdd } from "../quick-add";

export default async function Cierre({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { store } = await requireApp();
  const period = periodFrom(store, sp);
  const hoy = today(store);
  const st = closeStatus(store, period, hoy);
  const KEYS = ["preparar", "cobrar", "conciliar", "liquidar", "cerrar"];
  const paso = typeof sp.paso === "string" && KEYS.includes(sp.paso) ? sp.paso : st.steps.find((x) => !x.complete)?.key ?? "cerrar";
  const close = store.closes.find((c) => c.period === period);
  const active = store.contracts.filter((c) => contractCoversPeriod(c, period));
  const due = active.filter((c) => adjustmentPeriods(c, period).includes(period));
  const expenses = store.expenses.filter((e) => e.period === period);
  const stepTasks = (k: string) => st.tasks.filter((t) => t.step === k);

  const mismatches = indexMismatches(store.org.profile, due);
  return (
    <>
      <div className="head">
        <div><h1>Cierre del mes</h1><p>Un paso a la vez. Tocá un paso para verlo.</p></div>
        <div className="head-actions"><PeriodPicker period={period} base={`/cierre?paso=${paso}`} /><QuickAdd store={store} period={period} hoy={hoy} /></div>
      </div>
      <Stepper steps={st.steps} period={period} current={paso} />
      {paso === "preparar" && store.org.profile?.indices.includes("no_se") && (
        <p className="focus-note">Nos dijiste que no estás seguro de qué índice usan tus contratos. En cada aumento figura el índice cargado: comparalo con la cláusula del contrato antes de aprobar.</p>
      )}
      {paso === "preparar" && mismatches.length > 0 && (
        <p className="focus-note">{mismatches.map((c) => c.code).join(", ")} {mismatches.length === 1 ? "usa" : "usan"} un índice que no nombraste en tus respuestas. Revisá que esté bien cargado.</p>
      )}

      {paso === "preparar" && <section className="section" id="preparar">
        <header><h2>Preparar el mes</h2><span className={`chip ${st.steps[0].complete ? "ok" : "warn"}`}>{st.steps[0].complete ? "Completo" : "Pendiente"}</span></header>
        <div className="body">
          <h3>Aumentos que tocan en {formatPeriod(period)}</h3>
          {due.length === 0 && <p className="muted">Ningún contrato tiene aumento este mes.</p>}
          {due.map((c) => {
            const a = computeAdjustment(store, c, period);
            const exp = explainAdjustment(a);
            const done = a.status === "aprobado" || a.status === "comunicado";
            return (
              <div key={c.id} className="calc" id={`aum-${c.id}`}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <b><Link href={`/contratos/${c.id}?periodo=${period}`}>{c.code}</Link> · {propertyLabel(store, c.propertyId)}</b>
                  <span className={`chip ${done ? "ok" : a.status === "calculado" ? "info" : "warn"}`}>{done ? "Aprobado" : a.status === "calculado" ? "Calculado, falta aprobar" : "Pendiente de datos"}</span>
                </div>
                <div className="big-line">Hoy paga <M m={a.previous} />{a.result && <> · pasa a pagar <b><M m={a.result} /></b></>}</div>
                <details>
                  <summary className="small">Ver de dónde sale</summary>
                  <div className="small">Índice pactado: {INDEX_LABEL[c.adjustment!.index]}, cada {c.adjustment!.everyMonths} meses.</div>
                  {c.adjustment!.clauseText && <div className="small muted">Cláusula: “{c.adjustment!.clauseText}”</div>}
                  {exp && <div className="small num">{exp}</div>}
                  {a.result && <div className="small muted">Redondeo: {describeRounding(a.rounding)}</div>}
                </details>
                {a.approved && <div className="muted">Aprobado por {a.approved.approvedBy} el {formatDate(a.approved.approvedAt.slice(0, 10))}.</div>}
                {a.missing.map((m) => <div key={m} className="missing">{m}</div>)}
                {a.status === "calculado" && (
                  <ActionForm action={approveAdjustmentAction} submit="Aprobar aumento" confirm={`¿Aprobar el aumento de ${c.code} a ${formatMoney(a.result!)}? Desde ${formatPeriod(period)} el alquiler pasa a ese importe.`}>
                    <input type="hidden" name="contractId" value={c.id} /><input type="hidden" name="period" value={period} />
                  </ActionForm>
                )}
                {!done && c.adjustment!.referenceLagMonths === undefined && (
                  <ActionForm action={setLagAction} submit="Guardar regla" variant="ghost" className="stack">
                    <input type="hidden" name="contractId" value={c.id} />
                    <div className="row">
                      <label className="field">¿Qué mes del índice se usa?<select name="lag" defaultValue="1"><option value="0">El mismo mes del aumento</option><option value="1">El mes anterior</option><option value="2">Dos meses antes</option></select></label>
                      <label className="field">¿En qué te basás? (cláusula o acuerdo)<input name="basis" required placeholder="Ej.: cláusula 4, acordado por mail con el propietario" /></label>
                    </div>
                  </ActionForm>
                )}
                {a.missing.filter((m) => m.startsWith("Falta el valor")).map((m) => {
                  const p = /de (\d{4}-\d{2})/.exec(m)?.[1] ?? "";
                  return (
                    <ActionForm key={m} action={loadIndexAction} submit={`Cargar ${a.index} ${p}`} variant="ghost">
                      <input type="hidden" name="index" value={a.index} /><input type="hidden" name="period" value={p} />
                      <label className="field">Valor<input name="value" inputMode="decimal" required /></label>
                      <label className="field">Fuente<input name="source" required placeholder="Ej.: INDEC, informe del 14/10" /></label>
                    </ActionForm>
                  );
                })}
              </div>
            );
          })}

          <h3 id="gastos">Gastos del mes</h3>
          {expenses.length === 0 && <p className="muted">No hay gastos cargados en este período.</p>}
          {expenses.map((e) => {
            const c = store.contracts.find((x) => x.id === e.contractId)!;
            return (
              <div key={e.id} className="calc">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <b>{e.description}</b>
                  <span className={`chip ${e.status === "confirmado" ? "ok" : e.status === "pendiente" ? "warn" : "info"}`}>{e.status === "confirmado" ? "Confirmado" : e.status === "pendiente" ? "Pendiente de revisión" : "Descartado"}</span>
                </div>
                <div>{c.code} · <M m={e.amount} /> · a cargo del {e.bornBy} · {formatDate(e.date)}{e.provider ? ` · ${e.provider}` : ""}</div>
                {e.status === "pendiente" && (
                  <div className="row">
                    <ActionForm action={confirmExpenseAction} submit="Confirmar gasto"><input type="hidden" name="expenseId" value={e.id} /></ActionForm>
                    <details>
                      <summary className="small">Descartar</summary>
                      <ActionForm action={discardExpenseAction} submit="Descartar gasto" variant="ghost">
                        <input type="hidden" name="expenseId" value={e.id} />
                        <label className="field">Motivo<input name="reason" required /></label>
                      </ActionForm>
                    </details>
                  </div>
                )}
              </div>
            );
          })}
          <details>
            <summary>Cargar un gasto</summary>
            <ActionForm action={addExpenseAction} submit="Cargar gasto" className="stack">
              <input type="hidden" name="period" value={period} />
              <div className="row">
                <label className="field">Contrato<select name="contractId" required>{active.map((c) => <option key={c.id} value={c.id}>{c.code} · {propertyLabel(store, c.propertyId)} ({c.currency})</option>)}</select></label>
                <label className="field">Categoría<select name="category"><option value="arreglo">Arreglo</option><option value="mantenimiento">Mantenimiento</option><option value="servicio">Servicio</option><option value="expensas">Expensas</option><option value="otro">Otro</option></select></label>
              </div>
              <label className="field">Descripción<input name="description" required /></label>
              <div className="row">
                <label className="field">Importe (en la moneda del contrato)<input name="amount" inputMode="decimal" required placeholder="45.000,00" /></label>
                <label className="field">Fecha<input type="date" name="date" required defaultValue={hoy} /></label>
                <label className="field">Lo asume<select name="bornBy"><option value="propietario">El propietario</option><option value="inquilino">El inquilino</option></select></label>
              </div>
              <label className="field">Proveedor (opcional)<input name="provider" /></label>
            </ActionForm>
          </details>
        </div>
      </section>}

      {(["cobrar", "conciliar", "liquidar"] as const).filter((k) => k === paso).map((k) => {
        const step = st.steps.find((s) => s.key === k)!;
        const href = k === "liquidar" ? `/propietarios?periodo=${period}` : `/cobranzas?periodo=${period}${k === "conciliar" ? "&ver=pagos" : ""}`;
        return (
          <section className="section" id={k} key={k}>
            <header><h2>{step.title}</h2><span className={`chip ${step.complete ? "ok" : "warn"}`}>{step.complete ? "Completo" : "Pendiente"}</span></header>
            <div className="body">
              <p className="muted" style={{ margin: 0 }}>{step.summary}.</p>
              {stepTasks(k).slice(0, 5).map((t) => <div key={t.id} className="small">• {t.title}: <span className="muted">{t.detail}</span></div>)}
              <div><Link className="btn ghost" href={href}>{k === "liquidar" ? "Ir a liquidaciones" : k === "cobrar" ? "Ir a cobranzas" : "Ir a los pagos"}</Link></div>
            </div>
          </section>
        );
      })}

      {paso === "cerrar" && <section className="section" id="cerrar">
        <header><h2>Revisar y cerrar</h2><span className={`chip ${close ? "ok" : "warn"}`}>{close ? "Cerrado" : "Abierto"}</span></header>
        <div className="body">
          {close ? (
            <>
              <p style={{ margin: 0 }}>Cerrado por {close.closedBy} el {formatDate(close.closedAt.slice(0, 10))}.</p>
              {close.exceptions.length > 0 && <div className="calc"><b>Se cerró con {close.exceptions.length} pendientes.</b><div>Motivo: {close.exceptionReason}</div>{close.exceptions.map((e) => <div key={e} className="muted">• {e}</div>)}</div>}
              <p className="small muted">Un mes cerrado no se modifica. Las correcciones se cargan en el mes siguiente.</p>
            </>
          ) : (
            <>
              {st.blockers.length > 0 ? (
                <p className="missing" style={{ margin: 0 }}>Hay {st.blockers.length} pendientes que bloquean el cierre. Lo ideal es resolverlos; si necesitás cerrar igual, dejá escrito el motivo.</p>
              ) : (
                <p style={{ margin: 0 }}>Todo está resuelto. Podés cerrar el mes.</p>
              )}
              <ActionForm action={closePeriodAction} submit={st.blockers.length ? "Cerrar con excepciones" : "Cerrar el mes"} variant={st.blockers.length ? "danger" : "primary"} className="stack" confirm={`¿Cerrar ${formatPeriod(period)}? Después no se van a poder cambiar pagos, aumentos ni gastos de este mes.`}>
                <input type="hidden" name="period" value={period} />
                {st.blockers.length > 0 && <label className="field">Motivo para cerrar con pendientes<textarea name="reason" rows={2} required /></label>}
              </ActionForm>
            </>
          )}
          <details>
            <summary>Historial de cambios ({store.audit.length})</summary>
            <ul className="small" style={{ paddingLeft: 18 }}>
              {store.audit.slice(-30).reverse().map((e) => (
                <li key={e.id}>{new Date(e.at).toLocaleString("es-AR")} · {e.actor} {e.action}{e.detail ? ` (${e.detail})` : ""}{e.reason ? `. Motivo: ${e.reason}` : ""}</li>
              ))}
              {store.audit.length === 0 && <li className="muted">Todavía no hay cambios registrados.</li>}
            </ul>
          </details>
        </div>
      </section>}
    </>
  );
}
