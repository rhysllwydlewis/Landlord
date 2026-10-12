"use client";
import { Printer } from "lucide-react";
import { useHydrated } from "./use-hydrated";
export function ReceiptActions() {
  const ready = useHydrated();
  return (
    <div className="receipt-actions">
      <button
        className="button primary"
        disabled={!ready}
        onClick={() => window.print()}
      >
        <Printer size={16} />
        Print / save PDF
      </button>
    </div>
  );
}
