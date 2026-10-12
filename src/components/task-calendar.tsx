"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Panel } from "./ui";
import type { Row } from "./resource-table";
export function TaskCalendar({ rows }: { rows: Row[] }) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
  );
  const start = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return (
    <Panel
      title="Task calendar"
      subtitle="Tasks from the current filtered results"
      action={
        <div className="calendar-navigation">
          <button
            className="icon-button"
            aria-label="Previous month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <ChevronLeft size={16} />
          </button>
          <strong>
            {month.toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
            })}
          </strong>
          <button
            className="icon-button"
            aria-label="Next month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <ChevronRight size={16} />
          </button>
        </div>
      }
    >
      <div className="calendar-scroll">
        <div className="calendar-grid">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <strong className="calendar-weekday" key={d}>
              {d}
            </strong>
          ))}
          {Array.from({ length: start }, (_, i) => (
            <div className="calendar-day empty-day" key={`empty${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
            const tasks = rows.filter(
              (r) => String(r.dueDate).slice(0, 10) === key,
            );
            return (
              <div className="calendar-day" key={key}>
                <span>{i + 1}</span>
                {tasks.map((t) => (
                  <div
                    key={String(t.id)}
                    className={
                      t.status === "completed"
                        ? "calendar-task done"
                        : "calendar-task"
                    }
                    title={String(t.title)}
                  >
                    {String(t.title)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
