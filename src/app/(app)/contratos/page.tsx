import Link from "next/link";
import { QuickAdd } from "../quick-add";
import { adjustmentPeriods } from "@/lib/domain/adjustments";
import { rentInForce } from "@/lib/domain/adjustments";
import { addMonths, formatDate, formatPeriod } from "@/lib/domain/period";
import { INDEX_LABEL } from "@/lib/domain/types";
import { periodFrom, requireApp, today } from "@/lib/server/store";
import { M, personName, propertyLabel } from "@/lib/view";
import { contractKey, isHidden } from "@/lib/domain/hidden";
import { hideItemAction, showItemAction } from "../../actions";
import { IconAction } from "../../ui";

const PAGE = 25;

export default async function Contratos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { store } = await requireApp();
  const period = periodFrom(store, sp);
  const hoy = today(store);
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const page = Math.max(1, Number(sp.pagina) || 1);
  const hiddenContracts = store.contracts.filter((c) => c.status !== "archivado" && isHidden(store, contractKey(c.id)));
  const rows = store.contracts
    .filter((c) => c.status !== "archivado" && !isHidden(store, contractKey(c.id)))
    .filter((c) => {
      if (!q) return true;
      const hay = [c.code, propertyLabel(store, c.propertyId), ...c.tenantIds.map((t) => personName(store, t)), ...c.owners.map((o) => personName(store, o.ownerId))].join(" ").toLowerCase();
      return hay.includes(q);
    });
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));

  return (
    <>
      <div className="head">
        <div><h1>Contratos</h1><p>{rows.length} contratos{q ? ` que coinciden con “${q}”` : " activos"}.</p></div>
        <div className="head-actions"><QuickAdd store={store} period={period} hoy={hoy} /></div>
      </div>
      {store.org.profile?.tool === "excel" && <p className="focus-note">Pronto vas a poder traer tus contratos desde tu planilla de Excel. Todavía no está disponible.</p>}
      <section className="section">
        <header>
          <form className="aform inline" role="search" style={{ flex: "1 1 320px" }}>
            <input type="hidden" name="periodo" value={period} />
            <label className="field" style={{ flex: 1 }}><span className="sr">Buscar</span><input name="q" defaultValue={q} placeholder="Buscar por código, dirección, inquilino o propietario" /></label>
            <button className="btn ghost" type="submit">Buscar</button>
          </form>
        </header>
        <div className="body flush tbl">
          {shown.length === 0 ? <p className="empty">No encontré contratos con esa búsqueda.</p> : (
            <table className="cards">
              <thead><tr><th>Contrato</th><th>Inquilino</th><th>Propietarios</th><th className="r">Alquiler vigente</th><th>Próximo aumento</th><th>Datos</th><th><span className="sr">Acciones</span></th></tr></thead>
              <tbody>
                {shown.map((c) => {
                  const nextAdj = adjustmentPeriods(c, addMonths(period, 24)).find((p) => p >= period);
                  const missing = [!c.adjustment ? null : c.adjustment.referenceLagMonths === undefined ? "Falta definir el mes del índice" : null, c.owners.reduce((s, o) => s + o.shareBps, 0) !== 10000 ? "Porcentajes de propietarios" : null].filter(Boolean);
                  return (
                    <tr key={c.id}>
                      <td><Link href={`/contratos/${c.id}?periodo=${period}`}><b>{c.code}</b></Link><div className="small muted">{propertyLabel(store, c.propertyId)}</div></td>
                      <td>{c.tenantIds.map((t) => personName(store, t)).join(", ")}</td>
                      <td>{c.owners.map((o) => personName(store, o.ownerId)).join(", ")}</td>
                      <td className="r"><M m={rentInForce(c, period, store.adjustments)} /><div className="small muted">vence el día {c.dueDay}</div></td>
                      <td>{c.adjustment ? (nextAdj ? `${formatPeriod(nextAdj)} · ${INDEX_LABEL[c.adjustment.index]}` : "Sin más aumentos") : "Sin cláusula"}<div className="small muted">hasta {formatDate(c.endDate)}</div></td>
                      <td>{missing.length ? <span className="chip warn">{missing[0]}</span> : <span className="chip ok">Completos</span>}</td>
                      <td className="act"><IconAction action={hideItemAction} fields={{ key: contractKey(c.id) }} label="Quitar de la lista"
                        confirm={`¿Quitar ${c.code} de la lista de contratos? No se borra el contrato: sus alquileres siguen apareciendo en Cobranzas y lo podés volver a mostrar.`} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
      {pages > 1 && (
        <div className="row">
          {page > 1 && <Link className="btn ghost" href={`?periodo=${period}&q=${q}&pagina=${page - 1}`}>Anterior</Link>}
          <span className="muted small">Página {page} de {pages}</span>
          {page < pages && <Link className="btn ghost" href={`?periodo=${period}&q=${q}&pagina=${page + 1}`}>Siguiente</Link>}
        </div>
      )}
      {hiddenContracts.length > 0 && (
        <details className="section more">
          <summary>Quitados ({hiddenContracts.length})</summary>
          <div className="body hidden-list">
            {hiddenContracts.map((c) => (
              <div key={c.id} className="calc row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span><b>{c.code}</b> · {propertyLabel(store, c.propertyId)}</span>
                <IconAction action={showItemAction} fields={{ key: contractKey(c.id) }} label="Volver a mostrar" kind="restore" />
              </div>
            ))}
          </div>
        </details>
      )}
      <p className="small muted">La carga y edición de contratos llega en la próxima versión. En la demo los contratos vienen precargados.</p>
    </>
  );
}
