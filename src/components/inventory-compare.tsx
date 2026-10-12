"use client";
import { useState } from "react";
import { Panel } from "./ui";
import { obj, str, type Row } from "./resource-table";
export function InventoryCompare({ rows }: { rows: Row[] }) {
  const [left, setLeft] = useState(str(rows[0]?.id));
  const [right, setRight] = useState(str(rows[1]?.id));
  const l = rows.find((r) => r.id === left),
    r = rows.find((r) => r.id === right);
  return (
    <Panel
      title="Side-by-side condition comparison"
      subtitle="Review changes manually. Differences do not establish responsibility; consider fair wear and tear."
    >
      <div className="compare-grid">
        {[
          { value: left, set: setLeft, row: l },
          { value: right, set: setRight, row: r },
        ].map((side, i) => (
          <div key={i}>
            <select
              aria-label={`Select ${i === 0 ? "before" : "after"} inventory`}
              value={side.value}
              onChange={(e) => side.set(e.target.value)}
            >
              <option value="">Choose a report</option>
              {rows.map((r) => (
                <option key={str(r.id)} value={str(r.id)}>
                  {str(r.title)}
                </option>
              ))}
            </select>
            {side.row &&
              ((obj(side.row.data).items as Row[]) || []).map((x, j) => (
                <div className="comparison-item" key={j}>
                  <strong>
                    {str(x.room)} — {str(x.item)}
                  </strong>
                  <span>{str(x.condition)}</span>
                  <p>{str(x.notes)}</p>
                </div>
              ))}
          </div>
        ))}
      </div>
    </Panel>
  );
}
