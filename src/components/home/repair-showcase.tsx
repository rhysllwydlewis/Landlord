"use client";
import { useHydrated } from "../use-hydrated";
import { useState } from "react";
import {
  Check,
  House,
  LockKeyhole,
  ShieldCheck,
  Wrench,
  Users,
  MessageCircle,
} from "lucide-react";
export function RepairShowcase() {
  const hydrated = useHydrated();
  const [tenant, setTenant] = useState(true);
  return (
    <div className="home-repair-demo">
      <div
        className="home-repair-view-toggle"
        role="group"
        aria-label="Choose repair preview perspective"
      >
        <button
          type="button"
          disabled={!hydrated}
          aria-pressed={tenant}
          onClick={() => setTenant(true)}
        >
          <Users size={13} />
          Tenant view
        </button>
        <button
          type="button"
          disabled={!hydrated}
          aria-pressed={!tenant}
          onClick={() => setTenant(false)}
        >
          <House size={13} />
          Landlord view
        </button>
      </div>
      <div className="home-repair-ticket glass" key={String(tenant)}>
        <div className="home-ticket-top">
          <span className="home-demo-repair-icon">
            <Wrench size={20} />
          </span>
          <span className="home-status">In progress</span>
        </div>
        <span className="home-ticket-reference">REP-EXAMPLE-001</span>
        <h3>Kitchen tap leaking</h3>
        <p>12 Willow Road · Room 1</p>
        <div className="home-ticket-description">
          The kitchen tap is dripping even when it’s turned off. Please could
          you take a look?
        </div>
        <div className="home-ticket-timeline">
          <div>
            <span>
              <Check size={11} />
            </span>
            <strong>Reported</strong>
            <small>Issue received</small>
          </div>
          <div>
            <span>
              <Check size={11} />
            </span>
            <strong>Acknowledged</strong>
            <small>Landlord updated</small>
          </div>
          <div className="home-ticket-current">
            <span />
            <strong>In progress</strong>
            <small>Work recorded</small>
          </div>
        </div>
        <div className="home-ticket-message">
          <MessageCircle size={14} />
          <div>
            <strong>An update from your landlord</strong>
            <p>
              Thanks for the report. I’ve reviewed the issue and will keep you
              updated here.
            </p>
          </div>
        </div>
        {!tenant && (
          <div className="home-ticket-private">
            <LockKeyhole size={13} />
            <div>
              <strong>Internal note · landlord only</strong>
              <p>
                Review the repair cost and retain the receipt with the property
                records.
              </p>
            </div>
          </div>
        )}
        <div className="home-ticket-footer">
          <ShieldCheck size={13} />
          {tenant
            ? "Only permitted updates are shown to this tenant."
            : "Your internal notes stay private when you share updates."}
        </div>
      </div>
      <p className="home-repair-demo-caption">
        Illustrative repair preview · sample data
      </p>
    </div>
  );
}
