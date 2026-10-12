import { describe, it, expect } from "vitest";
import {
  outstanding,
  allocate,
  rentDates,
  forecast,
  depositBalance,
  anomalies,
} from "@/lib/calculations";
import { validateImport } from "@/server/imports";
describe("Financial integrity", () => {
  it("calculates partial rent balances in pence", () => {
    expect(
      outstanding(85000, [{ amountPence: 30000 }, { amountPence: 10000 }]),
    ).toBe(45000);
  });
  it("allocates oldest obligations and retains overpayments", () => {
    expect(
      allocate(100000, [
        { id: "a", balance: 40000 },
        { id: "b", balance: 30000 },
      ]),
    ).toEqual({
      allocations: [
        { obligationId: "a", amountPence: 40000 },
        { obligationId: "b", amountPence: 30000 },
      ],
      creditPence: 30000,
    });
  });
  it("does not allocate to fully paid obligations", () => {
    expect(
      allocate(100, [
        { id: "a", balance: 0 },
        { id: "b", balance: 200 },
      ]).allocations,
    ).toEqual([{ obligationId: "b", amountPence: 100 }]);
  });
  it("clamps monthly due days without drifting from month to month", () => {
    expect(
      rentDates(
        new Date("2024-01-01"),
        new Date("2024-04-30"),
        "monthly",
        31,
      ).map((d) => d.toISOString().slice(0, 10)),
    ).toEqual(["2024-01-31", "2024-02-29", "2024-03-31", "2024-04-30"]);
  });
  it("generates anchored fortnightly dates", () => {
    expect(
      rentDates(
        new Date("2026-01-01"),
        new Date("2026-01-30"),
        "fortnightly",
        1,
      ).map((d) => d.getUTCDate()),
    ).toEqual([1, 15, 29]);
  });
  it("discloses deterministic yield and vacancy assumptions", () => {
    const f = forecast({
      monthlyRentPence: 100000,
      monthlyExpensePence: 20000,
      maintenancePence: 60000,
      vacancyPercent: 5,
      valuePence: 20000000,
      investmentPence: 5000000,
      growthPercent: 2,
      years: 2,
    });
    expect(f.annualIncomePence).toBe(1140000);
    expect(f.cashflowPence).toBe(840000);
    expect(f.netYield).toBeCloseTo(4.2);
    expect(f.grossYield).toBe(6);
    expect(f.years[1].incomePence).toBe(1162800);
  });
  it("handles zero property valuations safely", () => {
    expect(
      forecast({
        monthlyRentPence: 0,
        monthlyExpensePence: 0,
        maintenancePence: 0,
        vacancyPercent: 0,
        valuePence: 0,
        investmentPence: 0,
        growthPercent: 0,
        years: 1,
      }).roi,
    ).toBe(0);
  });
  it("subtracts only agreed deposit deductions", () => {
    expect(
      depositBalance(100000, 20000, [
        { amountPence: 10000, accepted: true },
        { amountPence: 20000, accepted: false },
      ]),
    ).toBe(70000);
  });
  it("flags duplicate expenses for review without altering them", () => {
    const records = [
      {
        id: "a",
        propertyId: "p",
        description: "Boiler",
        amountPence: 60000,
        invoiceReference: "INV1",
      },
      {
        id: "b",
        propertyId: "p",
        description: "Boiler",
        amountPence: 60000,
        invoiceReference: "INV1",
      },
    ];
    expect(anomalies(records)).toHaveLength(4);
    expect(records[0].amountPence).toBe(60000);
  });
});
describe("Import validation", () => {
  it("maps pounds and normalises tenant email", () => {
    const rows = validateImport(
      "tenants",
      [{ Name: "Jamie", Email: "JAMIE@example.test" }],
      { name: "Name", email: "Email" },
    );
    expect(rows[0].errors).toHaveLength(0);
    expect(rows[0].data).toMatchObject({ email: "jamie@example.test" });
  });
  it("rejects invalid and missing property fields", () => {
    expect(
      validateImport("properties", [{ Address: "x" }], {
        address: "Address",
      })[0].errors.length,
    ).toBeGreaterThan(0);
  });
  it("converts currency values without float storage", () => {
    const r = validateImport(
      "expenses",
      [
        {
          Property: "p",
          Category: "Repairs",
          Description: "Tap repair",
          Amount: "12.34",
          Date: "2026-10-10",
        },
      ],
      {
        propertyId: "Property",
        category: "Category",
        description: "Description",
        amountPence: "Amount",
        incurredAt: "Date",
      },
    );
    expect(r[0].data).toMatchObject({ amountPence: 1234 });
  });
});
