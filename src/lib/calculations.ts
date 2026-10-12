export const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    pence / 100,
  );
export const date = (value: string | Date | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(value))
    : "—";
// Ledger due dates are calendar dates, so a charge due today is not overdue.
export function utcDay(value = new Date()) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}
export function outstanding(
  amountPence: number,
  allocations: { amountPence: number }[],
) {
  return Math.max(
    0,
    amountPence - allocations.reduce((s, x) => s + x.amountPence, 0),
  );
}
export function allocate(
  amount: number,
  obligations: { id: string; balance: number }[],
) {
  let remainder = amount;
  const allocations: { obligationId: string; amountPence: number }[] = [];
  for (const o of obligations) {
    const n = Math.min(remainder, Math.max(0, o.balance));
    if (n > 0) allocations.push({ obligationId: o.id, amountPence: n });
    remainder -= n;
    if (!remainder) break;
  }
  return { allocations, creditPence: remainder };
}
export function rentDates(
  start: Date,
  end: Date,
  frequency: string,
  dueDay: number,
) {
  const result: Date[] = [];
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  if (frequency === "weekly" || frequency === "fortnightly") {
    for (
      ;
      cursor <= end;
      cursor.setUTCDate(cursor.getUTCDate() + (frequency === "weekly" ? 7 : 14))
    )
      result.push(new Date(cursor));
  } else {
    const step =
      frequency === "quarterly" ? 3 : frequency === "annual" ? 12 : 1;
    for (let y = start.getUTCFullYear(), m = start.getUTCMonth(); ; m += step) {
      y += Math.floor(m / 12);
      m %= 12;
      const d = new Date(
        Date.UTC(
          y,
          m,
          Math.min(dueDay, new Date(Date.UTC(y, m + 1, 0)).getUTCDate()),
        ),
      );
      if (d > end) break;
      if (d >= start) result.push(d);
    }
  }
  return result;
}
export type ForecastInput = {
  monthlyRentPence: number;
  monthlyExpensePence: number;
  maintenancePence: number;
  vacancyPercent: number;
  valuePence: number;
  investmentPence: number;
  growthPercent: number;
  years: number;
};
export function forecast(x: ForecastInput) {
  const income = Math.round(
    x.monthlyRentPence * 12 * (1 - x.vacancyPercent / 100),
  );
  const expenses = x.monthlyExpensePence * 12 + x.maintenancePence;
  return {
    annualIncomePence: income,
    annualExpensesPence: expenses,
    cashflowPence: income - expenses,
    grossYield: x.valuePence
      ? ((x.monthlyRentPence * 12) / x.valuePence) * 100
      : 0,
    netYield: x.valuePence ? ((income - expenses) / x.valuePence) * 100 : 0,
    roi: x.investmentPence
      ? ((income - expenses) / x.investmentPence) * 100
      : 0,
    years: Array.from({ length: x.years }, (_, i) => ({
      year: i + 1,
      incomePence: Math.round(income * (1 + x.growthPercent / 100) ** i),
      expensesPence: expenses,
    })),
  };
}
export function depositBalance(
  amount: number,
  returned: number,
  deductions: { amountPence: number; accepted: boolean }[],
) {
  return (
    amount -
    returned -
    deductions.filter((d) => d.accepted).reduce((s, d) => s + d.amountPence, 0)
  );
}
export function anomalies(
  expenses: {
    id: string;
    amountPence: number;
    description: string;
    invoiceReference: string;
    propertyId: string;
  }[],
  highThreshold = 50000,
) {
  const results: {
    id: string;
    severity: string;
    reason: string;
    relatedIds: string[];
  }[] = [];
  for (const x of expenses) {
    const duplicates = expenses.filter(
      (y) =>
        y.id !== x.id &&
        y.propertyId === x.propertyId &&
        y.amountPence === x.amountPence &&
        ((x.invoiceReference && x.invoiceReference === y.invoiceReference) ||
          x.description === y.description),
    );
    if (duplicates.length)
      results.push({
        id: `duplicate:${x.id}`,
        severity: "review",
        reason:
          "Matching amount and invoice reference or description. Review for a possible duplicate.",
        relatedIds: [x.id, ...duplicates.map((y) => y.id)],
      });
    if (x.amountPence > highThreshold)
      results.push({
        id: `high:${x.id}`,
        severity: "attention",
        reason: `Expense exceeds the configured review threshold of ${money(highThreshold)}.`,
        relatedIds: [x.id],
      });
  }
  return results;
}
