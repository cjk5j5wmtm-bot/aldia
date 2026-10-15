import { money } from "../domain/money";
import type { Store } from "../domain/types";

/**
 * Datos de demostración. Todo es ficticio: personas, direcciones, teléfonos e importes.
 * Los valores de índices son INVENTADOS para la demo y no son datos oficiales del INDEC ni del BCRA.
 */
export const DEMO_TODAY = "2026-10-15";
export const DEMO_PERIOD = "2026-10";
const DEMO_SOURCE = "Valor ficticio de demostración (no es un dato oficial)";
const ARS = (pesos: number) => money(Math.round(pesos * 100), "ARS");
const USD = (d: number) => money(Math.round(d * 100), "USD");
const at = "2026-10-01T12:00:00.000Z";

export function demoStore(): Store {
  const org = { id: "org_demo", name: "Inmobiliaria Demo", isDemo: true };
  const p = (id: string, name: string, phone?: string, email?: string) => ({ id, orgId: org.id, name, phone, email });
  return {
    org,
    seq: 1000,
    people: [
      p("own_marta", "Marta Gómez (ficticia)", "11 0000-0001"),
      p("own_raul", "Raúl Ibarra (ficticio)", undefined, "raul@ejemplo.test"),
      p("own_ana", "Ana Sanz (ficticia)", "11 0000-0003"),
      p("own_jorge", "Jorge Sanz (ficticio)", "11 0000-0004"),
      p("ten_lucia", "Lucía Fernández (ficticia)", "11 0000-1001"),
      p("ten_martin", "Martín Sosa (ficticio)", "11 0000-1002"),
      p("ten_carolina", "Carolina Paz (ficticia)", "11 0000-1003"),
      p("ten_diego", "Diego Ledesma (ficticio)", "11 0000-1004"),
      p("ten_julieta", "Julieta Rey (ficticia)", "11 0000-1005"),
      p("ten_pablo", "Pablo Ortiz (ficticio)"),
      p("ten_sofia", "Sofía Méndez (ficticia)", "11 0000-1007"),
      p("ten_andres", "Andrés Vidal (ficticio)", "11 0000-1008"),
    ],
    properties: [
      { id: "prp_1", orgId: org.id, address: "Calle Ejemplo 100", unit: "3° B" },
      { id: "prp_2", orgId: org.id, address: "Calle Ejemplo 200", unit: "PB" },
      { id: "prp_3", orgId: org.id, address: "Pasaje Demo 35", unit: "7° A" },
      { id: "prp_4", orgId: org.id, address: "Avenida Ficticia 1500", unit: "2° C" },
      { id: "prp_5", orgId: org.id, address: "Avenida Ficticia 2300", unit: "10° D" },
      { id: "prp_6", orgId: org.id, address: "Calle Prueba 480", unit: "1° A" },
      { id: "prp_7", orgId: org.id, address: "Pasaje Demo 12", unit: "4° B" },
      { id: "prp_8", orgId: org.id, address: "Calle Prueba 905", unit: "6° A" },
    ],
    contracts: [
      {
        id: "ctr_1", orgId: org.id, code: "C-001", propertyId: "prp_1", owners: [{ ownerId: "own_marta", shareBps: 10000 }], tenantIds: ["ten_lucia"],
        startDate: "2025-11-01", endDate: "2028-10-31", currency: "ARS", initialRent: ARS(620000), dueDay: 5,
        adjustment: { index: "IPC", everyMonths: 3, firstPeriod: "2026-11", referenceLagMonths: 1, clauseText: "Se actualiza cada 3 meses por IPC, tomando el último índice publicado al mes anterior." },
        commissionBps: 600, commissionPaidBy: "propietario",
        lateFee: { kind: "interes_diario_simple", dailyRateBps: 10, graceDays: 3, accrueFrom: "vencimiento", clauseText: "Mora automática. Interés punitorio del 0,1% diario desde el vencimiento si se paga después del día 8." },
        status: "activo",
      },
      {
        id: "ctr_2", orgId: org.id, code: "C-002", propertyId: "prp_2", owners: [{ ownerId: "own_marta", shareBps: 10000 }], tenantIds: ["ten_martin"],
        startDate: "2025-10-01", endDate: "2027-09-30", currency: "ARS", initialRent: ARS(850000), dueDay: 10,
        adjustment: { index: "ICL", everyMonths: 6, firstPeriod: "2026-10", referenceLagMonths: 1, rounding: { mode: "nearest", toCents: 100000, fromContract: true }, clauseText: "Ajuste semestral por ICL. El importe se redondea a los $1.000 más cercanos." },
        commissionBps: 600, commissionPaidBy: "propietario", lateFee: null, status: "activo",
      },
      {
        id: "ctr_3", orgId: org.id, code: "C-003", propertyId: "prp_3", owners: [{ ownerId: "own_raul", shareBps: 10000 }], tenantIds: ["ten_carolina"],
        startDate: "2026-03-01", endDate: "2029-02-28", currency: "ARS", initialRent: ARS(540000), dueDay: 10,
        adjustment: { index: "IPC", everyMonths: 4, firstPeriod: "2026-11", referenceLagMonths: 1 },
        commissionBps: 500, commissionPaidBy: "propietario", lateFee: null, status: "activo",
      },
      {
        id: "ctr_4", orgId: org.id, code: "C-004", propertyId: "prp_4", owners: [{ ownerId: "own_raul", shareBps: 10000 }], tenantIds: ["ten_diego"],
        startDate: "2026-01-01", endDate: "2028-12-31", currency: "ARS", initialRent: ARS(658000), dueDay: 10,
        adjustment: { index: "IPC", everyMonths: 3, firstPeriod: "2026-07", referenceLagMonths: 1 },
        commissionBps: 500, commissionPaidBy: "propietario", lateFee: null, status: "activo",
      },
      {
        id: "ctr_5", orgId: org.id, code: "C-005", propertyId: "prp_5", owners: [{ ownerId: "own_ana", shareBps: 5000 }, { ownerId: "own_jorge", shareBps: 5000 }], tenantIds: ["ten_julieta"],
        startDate: "2026-05-01", endDate: "2029-04-30", currency: "ARS", initialRent: ARS(480000), dueDay: 12,
        adjustment: null, commissionBps: 600, commissionPaidBy: "propietario", lateFee: null, notes: "Contrato con precio fijo: no tiene cláusula de actualización cargada.", status: "activo",
      },
      {
        id: "ctr_6", orgId: org.id, code: "C-006", propertyId: "prp_6", owners: [{ ownerId: "own_ana", shareBps: 5000 }, { ownerId: "own_jorge", shareBps: 5000 }], tenantIds: ["ten_pablo"],
        startDate: "2026-02-01", endDate: "2029-01-31", currency: "ARS", initialRent: ARS(920000), dueDay: 20,
        adjustment: { index: "IPC", everyMonths: 4, firstPeriod: "2026-10", clauseText: "Se actualizará cada cuatro meses según la variación del IPC." },
        commissionBps: 600, commissionPaidBy: "propietario", lateFee: null, status: "activo",
      },
      {
        id: "ctr_7", orgId: org.id, code: "C-007", propertyId: "prp_7", owners: [{ ownerId: "own_raul", shareBps: 10000 }], tenantIds: ["ten_sofia"],
        startDate: "2026-01-01", endDate: "2027-12-31", currency: "USD", initialRent: USD(600), dueDay: 20,
        adjustment: null, commissionBps: 500, commissionPaidBy: "propietario", lateFee: null, notes: "Contrato en dólares.", status: "activo",
      },
      {
        id: "ctr_8", orgId: org.id, code: "C-008", propertyId: "prp_8", owners: [{ ownerId: "own_marta", shareBps: 10000 }], tenantIds: ["ten_andres"],
        startDate: "2026-04-01", endDate: "2029-03-31", currency: "ARS", initialRent: ARS(580000), dueDay: 10,
        adjustment: { index: "IPC", everyMonths: 6, firstPeriod: "2026-10", referenceLagMonths: 1 },
        commissionBps: 600, commissionPaidBy: "propietario", lateFee: null, status: "activo",
      },
    ],
    indexValues: [
      ...[["2026-01", 100], ["2026-03", 104.2], ["2026-04", 106.1], ["2026-06", 110.4], ["2026-07", 112.6], ["2026-09", 117.3]].map(([period, value]) => ({
        index: "IPC" as const, period: period as string, value: value as number, source: DEMO_SOURCE, loadedBy: "Datos demo", loadedAt: at,
      })),
      { index: "ICL", period: "2026-03", value: 20.15, source: DEMO_SOURCE, loadedBy: "Datos demo", loadedAt: at },
      { index: "ICL", period: "2026-09", value: 22.61, source: DEMO_SOURCE, loadedBy: "Datos demo", loadedAt: at },
    ],
    adjustments: [
      { id: "aum_1", contractId: "ctr_4", period: "2026-07", previous: ARS(658000), result: ARS(697151.63), index: "IPC", startRef: "2026-03", endRef: "2026-06", startValue: 104.2, endValue: 110.4, factor: 110.4 / 104.2, rounding: { mode: "nearest", toCents: 1, fromContract: false }, status: "comunicado", approvedBy: "Datos demo", approvedAt: at },
    ],
    payments: [
      { id: "pag_1", orgId: org.id, amount: ARS(540000), method: "transferencia", effectiveDate: "2026-10-09", recordedAt: at, recordedBy: "Datos demo", reference: "TRF-DEMO-0001", source: "manual", dedupeKey: "transferencia:ref:trf-demo-0001", status: "confirmado", confirmedBy: "Datos demo", confirmedAt: at, allocations: [{ id: "asg_1", chargeKey: "ctr_3:2026-10", amount: ARS(540000), by: "Datos demo", at }] },
      { id: "pag_2", orgId: org.id, amount: ARS(697151.63), method: "mercado_pago", effectiveDate: "2026-10-08", recordedAt: at, recordedBy: "Datos demo", reference: "MP-DEMO-0002", source: "manual", dedupeKey: "mercado_pago:ref:mp-demo-0002", status: "confirmado", confirmedBy: "Datos demo", confirmedAt: at, allocations: [{ id: "asg_2", chargeKey: "ctr_4:2026-10", amount: ARS(697151.63), by: "Datos demo", at }] },
      { id: "pag_3", orgId: org.id, amount: ARS(300000), method: "efectivo", effectiveDate: "2026-10-12", recordedAt: at, recordedBy: "Datos demo", source: "manual", dedupeKey: "efectivo:2026-10-12:ARS:30000000:andrés vidal", payerNote: "Andrés Vidal", status: "confirmado", confirmedBy: "Datos demo", confirmedAt: at, allocations: [{ id: "asg_3", chargeKey: "ctr_8:2026-10", amount: ARS(300000), by: "Datos demo", at }] },
      { id: "pag_4", orgId: org.id, amount: ARS(620000), method: "transferencia", effectiveDate: "2026-10-14", recordedAt: at, recordedBy: "Datos demo", source: "manual", dedupeKey: "transferencia:2026-10-14:ARS:62000000:lucía dice que pagó", payerNote: "Lucía dice que pagó, falta ver el extracto", status: "informado", allocations: [] },
      { id: "pag_5", orgId: org.id, amount: ARS(480000), method: "transferencia", effectiveDate: "2026-10-13", recordedAt: at, recordedBy: "Datos demo", reference: "TRF-DEMO-0005", source: "manual", dedupeKey: "transferencia:ref:trf-demo-0005", payerNote: "Transferencia recibida sin nombre", status: "confirmado", confirmedBy: "Datos demo", confirmedAt: at, allocations: [] },
    ],
    expenses: [
      { id: "gas_1", orgId: org.id, contractId: "ctr_2", description: "Cambio de cerradura", category: "arreglo", amount: ARS(45000), date: "2026-10-03", bornBy: "propietario", period: "2026-10", provider: "Cerrajería ficticia", status: "confirmado" },
      { id: "gas_2", orgId: org.id, contractId: "ctr_8", description: "Plomero: pérdida en el baño", category: "arreglo", amount: ARS(30000), date: "2026-10-11", bornBy: "propietario", period: "2026-10", status: "pendiente" },
    ],
    settlements: [],
    closes: [],
    audit: [],
  };
}
