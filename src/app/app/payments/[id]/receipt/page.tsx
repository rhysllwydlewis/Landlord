import Link from "next/link";
import { notFound } from "next/navigation";
import { context } from "@/server/context";
import { paymentReceipt } from "@/server/receipts";
import { money, date } from "@/lib/calculations";
import { brand } from "@/lib/config";
import { ReceiptActions } from "@/components/receipt-actions";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await context();
  let receipt;
  try {
    receipt = await paymentReceipt(ctx, (await params).id);
  } catch {
    notFound();
  }
  return (
    <>
      <Link className="back-link receipt-actions" href="/app/payments">
        ← Back to payments
      </Link>
      <ReceiptActions />
      <article className="payment-receipt panel record-form">
        <div className="eyebrow">{brand.name}</div>
        <h1>Payment receipt</h1>
        <p className="muted">
          Receipt for a payment recorded by your landlord.
        </p>
        <div className="stat-value">{money(receipt.amountPence)}</div>
        <dl className="detail-grid">
          <div>
            <dt>Landlord organisation</dt>
            <dd>{receipt.organisation.name}</dd>
          </div>
          <div>
            <dt>Payment reference</dt>
            <dd>{receipt.reference}</dd>
          </div>
          <div>
            <dt>Payment received</dt>
            <dd>{date(receipt.paidAt)}</dd>
          </div>
          <div>
            <dt>Payment method</dt>
            <dd>{receipt.method}</dd>
          </div>
          <div>
            <dt>Tenancy reference</dt>
            <dd>{receipt.tenancy.reference}</dd>
          </div>
          <div>
            <dt>Property</dt>
            <dd>
              {receipt.tenancy.property.name}
              {receipt.tenancy.unit ? ` · ${receipt.tenancy.unit.name}` : ""}
            </dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>
              {receipt.tenancy.property.address},{" "}
              {receipt.tenancy.property.postcode}
            </dd>
          </div>
        </dl>
        <h2>Current payment allocation</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Charge</th>
                <th>Due date</th>
                <th>Amount allocated</th>
              </tr>
            </thead>
            <tbody>
              {receipt.allocations.map((a, i) => (
                <tr key={i}>
                  <td>{a.obligation.description}</td>
                  <td>{date(a.obligation.dueDate)}</td>
                  <td>{money(a.amountPence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!receipt.allocations.length && (
          <p>No charges have been allocated to this payment yet.</p>
        )}
        <p>
          <strong>Unallocated credit:</strong> {money(receipt.creditPence)}
        </p>
        <p className="muted small">
          Generated {date(new Date())}. Allocations can change as new rent
          obligations are recorded. This receipt does not change your rent
          balance.
        </p>
      </article>
    </>
  );
}
