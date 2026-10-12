"use client";
import { useState } from "react";
import { money } from "@/lib/calculations";
export function IncomeChart({
  data,
  expenses = false,
}: {
  data: { label: string; incomePence: number; expensePence: number }[];
  expenses?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max =
    Math.max(
      10000,
      ...data.map((d) => Math.max(d.incomePence, d.expensePence)),
    ) * 1.2;
  const width = 700;
  const height = 190;
  const pts = data.map(
    (d, i) =>
      `${60 + i * (580 / (data.length - 1 || 1))},${height - 15 - (d.incomePence / max) * 150}`,
  );
  return (
    <div className="chart">
      <div className="chart-legend">
        <span>
          <i className="legend-dot" />
          {expenses ? "Income" : "Rent received"}
        </span>
        {expenses && (
          <span>
            <i className="legend-dot pale" />
            Expenses
          </span>
        )}
        {hover !== null && (
          <strong>
            {data[hover].label}: {money(data[hover].incomePence)}
            {expenses && ` / ${money(data[hover].expensePence)}`}
          </strong>
        )}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height + 30}`}
        role="img"
        aria-label="Income by month"
      >
        <defs>
          <linearGradient
            id={expenses ? "fill2" : "fill1"}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#226b56" stopOpacity=".18" />
            <stop offset="100%" stopColor="#226b56" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line
              x1="55"
              y1={height - 15 - v * 150}
              x2="655"
              y2={height - 15 - v * 150}
              stroke="#eceeea"
              strokeDasharray="3 4"
            />
            <text x="0" y={height - 11 - v * 150} fontSize="10" fill="#8e9790">
              £{Math.round((max * v) / 100).toLocaleString()}
            </text>
          </g>
        ))}
        <polygon
          points={`60,${height - 15} ${pts.join(" ")} 640,${height - 15}`}
          fill={`url(#${expenses ? "fill2" : "fill1"})`}
        />
        <polyline
          points={pts.join(" ")}
          fill="none"
          stroke="#226b56"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {expenses && (
          <polyline
            points={data
              .map(
                (d, i) =>
                  `${60 + i * (580 / (data.length - 1 || 1))},${height - 15 - (d.expensePence / max) * 150}`,
              )
              .join(" ")}
            fill="none"
            stroke="#a9bdaa"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
        )}
        {data.map((d, i) => (
          <g
            key={d.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <circle
              cx={60 + i * (580 / (data.length - 1 || 1))}
              cy={height - 15 - (d.incomePence / max) * 150}
              r={hover === i ? 5 : 3}
              fill="#226b56"
              stroke="white"
              strokeWidth="2"
            />
            <rect
              x={35 + i * (580 / (data.length - 1 || 1))}
              y="5"
              width="50"
              height="190"
              fill="transparent"
            />
            <text
              x={60 + i * (580 / (data.length - 1 || 1))}
              y={height + 15}
              textAnchor="middle"
              fontSize="11"
              fill="#818b85"
            >
              {d.label}
            </text>
          </g>
        ))}
      </svg>
      <span className="sr-only">
        {data
          .map(
            (d) =>
              `${d.label}: income ${money(d.incomePence)}, expenses ${money(d.expensePence)}`,
          )
          .join("; ")}
      </span>
    </div>
  );
}
