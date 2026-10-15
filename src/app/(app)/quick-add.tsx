import { chargesFor, contractCoversPeriod } from "@/lib/domain/charges";
import { formatMoney } from "@/lib/domain/money";
import type { Period } from "@/lib/domain/period";
import { METHOD_LABEL, type Store } from "@/lib/domain/types";
import { personName, propertyLabel } from "@/lib/view";
import { addExpenseAction, recordPaymentAction } from "../actions";
import { ActionForm, CloseDetails } from "../ui";

/** Botón "+" del encabezado: cargar un pago o un gasto desde cualquier pantalla. */
export function QuickAdd({ store, period, hoy }: { store: Store; period: Period; hoy: string }) {
  const open = chargesFor(store, period, hoy).filter((c) => c.balance.cents > 0);
  const active = store.contracts.filter((c) => contractCoversPeriod(c, period));
  return (
    <details className="pop">
      <summary className="btn plus" aria-label="Agregar un pago o un gasto" title="Agregar">+</summary>
      <div className="pop-body">
        <CloseDetails />
        <details open name="agregar">
          <summary><b>Registrar un pago</b></summary>
          <p className="small muted">Un pago que ya ocurrió. Al Día no cobra ni mueve dinero.</p>
          <ActionForm action={recordPaymentAction} submit="Registrar pago" className="stack">
            <input type="hidden" name="period" value={period} />
            <label className="field">¿De quién es?<select name="contractId" defaultValue=""><option value="">No sé todavía</option>{open.map((c) => <option key={c.key} value={c.contract.id}>{c.contract.code} · {personName(store, c.contract.tenantIds[0])} · debe {formatMoney(c.balance)}</option>)}</select></label>
            <div className="row">
              <label className="field">Importe<input name="amount" inputMode="decimal" required placeholder="620.000,00" /></label>
              <label className="field">Moneda<select name="currency"><option value="ARS">Pesos</option><option value="USD">Dólares</option></select></label>
            </div>
            <div className="row">
              <label className="field">Fecha<input type="date" name="date" required defaultValue={hoy} /></label>
              <label className="field">Medio<select name="method" defaultValue={store.org.profile && store.org.profile.pays !== "mezcla" ? store.org.profile.pays : "transferencia"}>{Object.entries(METHOD_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            </div>
            <details>
              <summary className="small">Más datos (opcional)</summary>
              <label className="field">Número de operación (evita cargarlo dos veces)<input name="reference" /></label>
              <label className="field">Nota<input name="note" placeholder="Ej.: pagó en la oficina" /></label>
            </details>
            <label className="field">¿Ya viste la plata?<select name="verified"><option value="no">Todavía no, me avisaron que pagó</option><option value="si">Sí, está en la cuenta o en mano</option></select></label>
          </ActionForm>
        </details>
        <details name="agregar">
          <summary><b>Cargar un gasto</b></summary>
          <p className="small muted">Un arreglo, una expensa o un servicio que se descuenta de la liquidación.</p>
          <ActionForm action={addExpenseAction} submit="Cargar gasto" className="stack">
            <input type="hidden" name="period" value={period} />
            <label className="field">Contrato<select name="contractId" required>{active.map((c) => <option key={c.id} value={c.id}>{c.code} · {propertyLabel(store, c.propertyId)} ({c.currency})</option>)}</select></label>
            <label className="field">Qué fue<input name="description" required placeholder="Ej.: arreglo de canilla" /></label>
            <div className="row">
              <label className="field">Importe<input name="amount" inputMode="decimal" required placeholder="45.000,00" /></label>
              <label className="field">Tipo<select name="category"><option value="arreglo">Arreglo</option><option value="mantenimiento">Mantenimiento</option><option value="servicio">Servicio</option><option value="expensas">Expensas</option><option value="otro">Otro</option></select></label>
            </div>
            <div className="row">
              <label className="field">Fecha<input type="date" name="date" required defaultValue={hoy} /></label>
              <label className="field">Lo paga<select name="bornBy"><option value="propietario">El propietario</option><option value="inquilino">El inquilino</option></select></label>
            </div>
            <label className="field">Proveedor (opcional)<input name="provider" /></label>
          </ActionForm>
        </details>
      </div>
    </details>
  );
}
