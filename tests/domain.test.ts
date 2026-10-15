import { describe, expect, it } from "vitest";
import { demoStore, DEMO_PERIOD, DEMO_TODAY } from "@/lib/demo/seed";
import { adjustmentPeriods, computeAdjustment, rentInForce } from "@/lib/domain/adjustments";
import { chargeFor, lateFeeFor } from "@/lib/domain/charges";
import { closePeriod, closeStatus } from "@/lib/domain/close";
import { add, money, percentOf, roundCents } from "@/lib/domain/money";
import { approveAdjustment, confirmExpense, discardExpense, loadIndexValue } from "@/lib/domain/operations";
import { allocate, confirmPayment, recordPayment, reverseAllocation, unallocated } from "@/lib/domain/payments";
import { dueDate } from "@/lib/domain/period";
import { approveSettlement, computeSettlement, registerExternalTransfer } from "@/lib/domain/settlements";
import type { Contract } from "@/lib/domain/types";

const U = "Tester";
const ctr = (s: ReturnType<typeof demoStore>, id: string) => s.contracts.find((c) => c.id === id)! as Contract;

describe("dinero", () => {
  it("no mezcla monedas", () => {
    expect(() => add(money(100, "ARS"), money(100, "USD"))).toThrow(/tipo de cambio/);
  });
  it("redondea según la regla", () => {
    expect(roundCents(12345.5)).toBe(12346);
    expect(roundCents(123456789, { mode: "nearest", toCents: 100000, fromContract: true })).toBe(123500000);
    expect(roundCents(123400001, { mode: "up", toCents: 100000, fromContract: true })).toBe(123500000);
    expect(roundCents(123499999, { mode: "down", toCents: 100000, fromContract: true })).toBe(123400000);
  });
  it("calcula porcentajes sin decimales flotantes en el resultado", () => {
    expect(percentOf(money(62000000, "ARS"), 600).cents).toBe(3720000);
  });
});

describe("fechas", () => {
  it("usa el último día del mes si el vencimiento no existe", () => {
    expect(dueDate("2026-02", 31)).toBe("2026-02-28");
  });
});

describe("aumentos por índice", () => {
  it("respeta la cadencia de cada contrato", () => {
    const s = demoStore();
    expect(adjustmentPeriods(ctr(s, "ctr_4"), "2027-04")).toEqual(["2026-07", "2026-10", "2027-01", "2027-04"]);
    expect(adjustmentPeriods(ctr(s, "ctr_2"), "2027-09")).toEqual(["2026-10", "2027-04"]);
  });

  it("calcula con los valores cargados y el redondeo del contrato", () => {
    const s = demoStore();
    const a = computeAdjustment(s, ctr(s, "ctr_2"), "2026-10");
    expect(a.status).toBe("calculado");
    expect(a.startRef).toBe("2026-03");
    expect(a.endRef).toBe("2026-09");
    // 850.000 × 22,61 / 20,15 = 953.796,52 → redondeado a $1.000 = 954.000
    expect(a.result!.cents).toBe(95400000);
  });

  it("parte del alquiler vigente, no del inicial, cuando ya hubo aumentos", () => {
    const s = demoStore();
    const a = computeAdjustment(s, ctr(s, "ctr_4"), "2026-10");
    expect(a.previous.cents).toBe(69715163);
    expect(a.result!.cents).toBe(Math.round((69715163 * 117.3) / 110.4));
  });

  it("queda pendiente si falta el valor de un índice, sin inventarlo", () => {
    const s = demoStore();
    s.indexValues = s.indexValues.filter((v) => !(v.index === "ICL" && v.period === "2026-09"));
    const a = computeAdjustment(s, ctr(s, "ctr_2"), "2026-10");
    expect(a.status).toBe("pendiente");
    expect(a.result).toBeUndefined();
    expect(a.missing.join(" ")).toMatch(/Falta el valor de ICL de 2026-09/);
  });

  it("queda pendiente si el contrato no dice qué mes del índice usar", () => {
    const s = demoStore();
    const a = computeAdjustment(s, ctr(s, "ctr_6"), "2026-10");
    expect(a.status).toBe("pendiente");
    expect(a.missing[0]).toMatch(/rezago/);
    expect(() => approveAdjustment(s, "ctr_6", "2026-10", U)).toThrow(/Todavía no se puede aprobar/);
  });

  it("una cláusula ambigua no se puede aprobar", () => {
    const s = demoStore();
    ctr(s, "ctr_2").adjustment!.ambiguity = "No queda claro si el ICL es al inicio o al fin de mes";
    expect(computeAdjustment(s, ctr(s, "ctr_2"), "2026-10").status).toBe("pendiente");
  });

  it("exige fuente al cargar un índice y no pisa uno existente", () => {
    const s = demoStore();
    expect(() => loadIndexValue(s, "IPC", "2026-10", 120, " ", U)).toThrow(/de dónde/);
    expect(() => loadIndexValue(s, "IPC", "2026-09", 120, "x", U)).toThrow(/Ya hay un valor/);
  });

  it("un aumento solo se aplica al aprobarlo y queda congelado", () => {
    const s = demoStore();
    const c = ctr(s, "ctr_2");
    expect(chargeFor(s, c, "2026-10", DEMO_TODAY).provisional).toBe(true);
    expect(rentInForce(c, "2026-10", s.adjustments).cents).toBe(85000000);
    approveAdjustment(s, "ctr_2", "2026-10", U);
    expect(rentInForce(c, "2026-10", s.adjustments).cents).toBe(95400000);
    expect(chargeFor(s, c, "2026-10", DEMO_TODAY).provisional).toBe(false);
    // Cambiar un índice después no altera lo aprobado.
    s.indexValues.find((v) => v.index === "ICL" && v.period === "2026-09")!.value = 30;
    expect(computeAdjustment(s, c, "2026-10").result!.cents).toBe(95400000);
    expect(s.audit.some((e) => e.action === "aprobó un aumento")).toBe(true);
  });
});

describe("punitorios", () => {
  it("no calcula nada si el contrato no tiene regla", () => {
    const s = demoStore();
    expect(chargeFor(s, ctr(s, "ctr_2"), "2026-10", DEMO_TODAY).lateFee).toBeNull();
  });
  it("respeta la gracia: pagar dentro de la gracia no genera punitorios", () => {
    const s = demoStore();
    const c = ctr(s, "ctr_1");
    expect(lateFeeFor(c, c.initialRent, "2026-10-05", [{ date: "2026-10-08", cents: c.initialRent.cents }], "2026-10-15")).toBeNull();
  });
  it("calcula interés simple diario desde el vencimiento sobre el saldo", () => {
    const s = demoStore();
    const c = ctr(s, "ctr_1");
    // 620.000 × 0,1% × 10 días = 6.200
    const f = lateFeeFor(c, c.initialRent, "2026-10-05", [], "2026-10-15");
    expect(f!.amount.cents).toBe(620000);
    expect(f!.status).toBe("calculado");
  });
  it("con pago parcial, el interés corre sobre el saldo restante", () => {
    const s = demoStore();
    const c = ctr(s, "ctr_1");
    // 5 días sobre 620.000 = 3.100; 5 días sobre 320.000 = 1.600
    const f = lateFeeFor(c, c.initialRent, "2026-10-05", [{ date: "2026-10-10", cents: 30000000 }], "2026-10-15");
    expect(f!.amount.cents).toBe(310000 + 160000);
  });
});

describe("pagos y conciliación", () => {
  it("no duplica un pago con la misma referencia", () => {
    const s = demoStore();
    const input = { amount: money(1000000, "ARS"), method: "transferencia" as const, effectiveDate: "2026-10-15", reference: "ABC-1", source: "manual" as const, status: "confirmado" as const };
    const a = recordPayment(s, input, U);
    const b = recordPayment(s, { ...input, reference: " abc-1 " }, U);
    expect(b.duplicate).toBe(true);
    expect(b.payment.id).toBe(a.payment.id);
  });

  it("un pago informado no cuenta como cobrado hasta confirmarlo", () => {
    const s = demoStore();
    allocate(s, "pag_4", "ctr_1", "2026-10", 62000000, U, DEMO_TODAY);
    let ch = chargeFor(s, ctr(s, "ctr_1"), "2026-10", DEMO_TODAY);
    expect(ch.confirmed.cents).toBe(0);
    expect(ch.informed.cents).toBe(62000000);
    expect(ch.status).toBe("vencido");
    confirmPayment(s, "pag_4", U);
    ch = chargeFor(s, ctr(s, "ctr_1"), "2026-10", DEMO_TODAY);
    expect(ch.status).toBe("pagado");
  });

  it("permite pagos parciales y no deja asignar más que el saldo", () => {
    const s = demoStore();
    const c = ctr(s, "ctr_8");
    expect(chargeFor(s, c, "2026-10", DEMO_TODAY).status).toBe("vencido");
    expect(chargeFor(s, c, "2026-10", DEMO_TODAY).balance.cents).toBe(28000000);
    const { payment } = recordPayment(s, { amount: money(50000000, "ARS"), method: "efectivo", effectiveDate: "2026-10-15", source: "manual", status: "confirmado", payerNote: "x" }, U);
    expect(() => allocate(s, payment.id, "ctr_8", "2026-10", 50000000, U, DEMO_TODAY)).toThrow(/supera el saldo/);
    allocate(s, payment.id, "ctr_8", "2026-10", 28000000, U, DEMO_TODAY);
    expect(unallocated(payment).cents).toBe(22000000);
  });

  it("no asigna un pago en pesos a un contrato en dólares", () => {
    const s = demoStore();
    expect(() => allocate(s, "pag_5", "ctr_7", "2026-10", 100, U, DEMO_TODAY)).toThrow(/ARS y el contrato en USD/);
  });

  it("revertir una asignación exige motivo y conserva el historial", () => {
    const s = demoStore();
    expect(() => reverseAllocation(s, "pag_1", "asg_1", U, "")).toThrow(/motivo/);
    reverseAllocation(s, "pag_1", "asg_1", U, "Era de otro inquilino");
    const p = s.payments.find((x) => x.id === "pag_1")!;
    expect(p.allocations).toHaveLength(1);
    expect(p.allocations[0].reversed?.reason).toBe("Era de otro inquilino");
    expect(chargeFor(s, ctr(s, "ctr_3"), "2026-10", DEMO_TODAY).confirmed.cents).toBe(0);
  });
});

describe("liquidaciones", () => {
  it("usa solo pagos confirmados, descuenta comisión y gastos confirmados", () => {
    const s = demoStore();
    const l = computeSettlement(s, "own_raul", "2026-10", "ARS", DEMO_TODAY);
    // C-003: 540.000 − 5% = 513.000; C-004: 697.151,63 − 5% = 662.294,05
    expect(l.collected.cents).toBe(54000000 + 69715163);
    expect(l.commission.cents).toBe(2700000 + 3485758);
    expect(l.net.cents).toBe(54000000 + 69715163 - 2700000 - 3485758);
  });

  it("no mezcla contratos en pesos y en dólares", () => {
    const s = demoStore();
    expect(computeSettlement(s, "own_raul", "2026-10", "USD", DEMO_TODAY).lines.map((l) => l.contractCode)).toEqual(["C-007"]);
  });

  it("reparte entre copropietarios según su porcentaje", () => {
    const s = demoStore();
    allocate(s, "pag_5", "ctr_5", "2026-10", 48000000, U, DEMO_TODAY);
    const ana = computeSettlement(s, "own_ana", "2026-10", "ARS", DEMO_TODAY);
    const line = ana.lines.find((l) => l.contractCode === "C-005")!;
    expect(line.collected.cents).toBe(24000000);
  });

  it("bloquea la aprobación con gastos pendientes o aumentos sin aprobar", () => {
    const s = demoStore();
    const l = computeSettlement(s, "own_marta", "2026-10", "ARS", DEMO_TODAY);
    expect(l.blockers.some((b) => /gasto/.test(b))).toBe(true);
    expect(l.blockers.some((b) => /aumento/.test(b))).toBe(true);
    expect(() => approveSettlement(s, "own_marta", "2026-10", "ARS", U, DEMO_TODAY)).toThrow(/No se puede aprobar/);
  });

  it("lo aprobado queda como foto y la transferencia se registra aparte", () => {
    const s = demoStore();
    approveAdjustment(s, "ctr_4", "2026-10", U);
    // Tras aprobar el aumento, el alquiler de C-004 sube y queda un saldo, pero la liquidación usa lo cobrado.
    const rec = approveSettlement(s, "own_raul", "2026-10", "ARS", U, DEMO_TODAY);
    const before = rec.snapshot.net.cents;
    reverseAllocation(s, "pag_1", "asg_1", U, "prueba");
    expect(s.settlements[0].snapshot.net.cents).toBe(before);
    expect(() => registerExternalTransfer(s, rec.id, "2026-10-16", "", U)).toThrow(/referencia/);
    registerExternalTransfer(s, rec.id, "2026-10-16", "TRF-123", U);
    expect(s.settlements[0].status).toBe("pago_registrado");
  });
});

describe("cierre del mes", () => {
  it("el avance sale de las tareas reales", () => {
    const s = demoStore();
    const st = closeStatus(s, DEMO_PERIOD, DEMO_TODAY);
    expect(st.steps.find((x) => x.key === "preparar")!.complete).toBe(false);
    expect(st.blockers.length).toBeGreaterThan(0);
  });

  it("no cierra con pendientes salvo que se deje un motivo, y después bloquea cambios", () => {
    const s = demoStore();
    expect(() => closePeriod(s, DEMO_PERIOD, U, DEMO_TODAY)).toThrow(/bloquean el cierre/);
    closePeriod(s, DEMO_PERIOD, U, DEMO_TODAY, "Cierre de prueba con pendientes conocidos");
    expect(s.closes[0].exceptions.length).toBeGreaterThan(0);
    expect(() => allocate(s, "pag_5", "ctr_5", DEMO_PERIOD, 100, U, DEMO_TODAY)).toThrow(/está cerrado/);
    expect(() => confirmExpense(s, "gas_2", U)).toThrow(/está cerrado/);
  });

  it("resolviendo todo, se puede cerrar sin excepciones", () => {
    const s = demoStore();
    for (const id of ["ctr_2", "ctr_4", "ctr_8"]) approveAdjustment(s, id, DEMO_PERIOD, U);
    ctr(s, "ctr_6").adjustment!.referenceLagMonths = 1;
    loadIndexValue(s, "IPC", "2026-05", 108.3, "Valor de prueba", U);
    approveAdjustment(s, "ctr_6", DEMO_PERIOD, U);
    discardExpense(s, "gas_2", U, "Lo paga el consorcio");
    s.payments = s.payments.filter((p) => p.id !== "pag_4");
    allocate(s, "pag_5", "ctr_5", DEMO_PERIOD, 48000000, U, DEMO_TODAY);
    for (const [o, c] of [["own_marta", "ARS"], ["own_raul", "ARS"], ["own_raul", "USD"], ["own_ana", "ARS"], ["own_jorge", "ARS"]] as const) {
      approveSettlement(s, o, DEMO_PERIOD, c, U, DEMO_TODAY);
    }
    const st = closeStatus(s, DEMO_PERIOD, DEMO_TODAY);
    expect(st.blockers).toEqual([]);
    closePeriod(s, DEMO_PERIOD, U, DEMO_TODAY);
    expect(s.closes[0].exceptionReason).toBeUndefined();
  });
});
