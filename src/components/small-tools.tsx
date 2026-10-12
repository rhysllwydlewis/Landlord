"use client";
import { useState } from "react";
import { requestJson } from "@/lib/http";
export function EntityForms() {
  const [message, setMessage] = useState("");
  return (
    <>
      <form
        className="inline-form"
        action={async (f) => {
          try {
            await requestJson(`/api/workspace/${f.get("type")}`, "POST", {
              name: f.get("name"),
            });
            setMessage("Record created.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        <select name="type" aria-label="Record type">
          <option value="portfolios">Portfolio</option>
          <option value="owners">Ownership entity</option>
        </select>
        <input
          name="name"
          placeholder="Name"
          aria-label="Portfolio or entity name"
          required
        />
        <button className="button secondary">Create</button>
      </form>
      {message && <p role="status">{message}</p>}
    </>
  );
}
export function AnomalyReview({ id }: { id: string }) {
  const [message, setMessage] = useState("");
  return (
    <form
      className="inline-form"
      action={async (f) => {
        try {
          await requestJson("/api/workspace/anomalyReviews", "POST", {
            title: "Financial signal review",
            data: {
              alertId: id,
              decision: f.get("decision"),
              notes: f.get("notes"),
            },
          });
          setMessage("Review saved.");
        } catch (e) {
          setMessage((e as Error).message);
        }
      }}
    >
      <select name="decision" aria-label="Review decision">
        <option value="dismissed">Dismiss after review</option>
        <option value="resolved">Resolved</option>
      </select>
      <input
        name="notes"
        aria-label="Review notes"
        placeholder="Reason / review notes"
        required
        minLength={3}
      />
      <button className="button secondary">Save review</button>
      {message && <span role="status">{message}</span>}
    </form>
  );
}
