"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { Panel } from "./ui";
export function PassportExport() {
  const [payments, setPayments] = useState(false);
  return (
    <Panel
      title="Your rental history, on your terms"
      subtitle="Only entries marked for sharing with consent are included."
    >
      <div className="record-form">
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={payments}
            onChange={(e) => setPayments(e.target.checked)}
          />
          Include my tenancy’s recorded payment history in this export
        </label>
        <p className="muted small">
          Ledger records are manually entered by the landlord and may cover a
          joint tenancy. They are distinguished from your self-reported entries;
          they are not bank verification, credit reporting or verification of an
          individual payer.
        </p>
        <a
          className="button secondary"
          href={`/api/passport?includePayments=${payments}`}
        >
          <Download size={15} />
          Download selected rental history
        </a>
      </div>
    </Panel>
  );
}
