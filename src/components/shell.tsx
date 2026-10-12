"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  House,
  Users,
  KeyRound,
  CirclePoundSterling,
  Wrench,
  ShieldCheck,
  Files,
  MessageSquare,
  CalendarDays,
  ChartNoAxesCombined,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  ArrowUpRight,
  HelpCircle,
  Layers,
  PanelLeftClose,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { brand } from "@/lib/config";
import { requestJson } from "@/lib/http";
import { BrandIcon } from "./ui";
import type { ReactNode } from "react";
const groups = [
  {
    label: "WORKSPACE",
    items: [
      ["/app", "Overview", LayoutDashboard, ""],
      ["/app/properties", "Properties", House, "properties"],
      ["/app/tenants", "Tenants", Users, "tenants"],
      ["/app/tenancies", "Tenancies", KeyRound, "tenancies"],
      ["/app/listings", "Lettings & applications", Layers, "lettings"],
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      ["/app/rent", "Rent & payments", CirclePoundSterling, "rent"],
      ["/app/repairs", "Repairs & maintenance", Wrench, "repairs"],
      ["/app/compliance", "Compliance", ShieldCheck, "compliance"],
      ["/app/documents", "Documents", Files, "documents"],
      ["/app/messages", "Messages", MessageSquare, "messages"],
      ["/app/tasks", "Tasks & calendar", CalendarDays, "tasks"],
    ],
  },
  {
    label: "INSIGHTS & MANAGEMENT",
    items: [
      ["/app/reports", "Reports & analytics", ChartNoAxesCombined, "reports"],
      [
        "/app/expenses",
        "Accounting & expenses",
        CirclePoundSterling,
        "finance",
      ],
      ["/app/operations", "More tools", Layers, "operations"],
      ["/app/settings", "Settings & billing", Settings, ""],
    ],
  },
] as const;
const tenantItems = [
  ["/app", "Dashboard", LayoutDashboard, ""],
  ["/app/tenancies", "My tenancy", KeyRound, ""],
  ["/app/rent", "Rent & payments", CirclePoundSterling, ""],
  ["/app/repairs", "Repairs", Wrench, ""],
  ["/app/messages", "Messages", MessageSquare, ""],
  ["/app/documents", "Documents", Files, ""],
  ["/app/deposits", "Deposit", ShieldCheck, ""],
  ["/app/transitions", "Move-in / move-out", CalendarDays, ""],
  ["/app/passport", "Rental passport", Users, ""],
  ["/app/feedback", "Feedback & requests", MessageSquare, ""],
  ["/app/settings", "Settings", Settings, ""],
] as const;
export function Shell({
  children,
  role,
  permissions,
  userName,
  organisation,
  organisations,
  unread,
  admin,
}: {
  children: ReactNode;
  role: string;
  permissions: string[];
  userName: string;
  organisation: { id: string; name: string };
  organisations: { id: string; name: string }[];
  unread: boolean;
  admin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const visible =
    role === "TENANT"
      ? [{ label: "YOUR HOME", items: tenantItems }]
      : role === "STAKEHOLDER"
        ? [
            {
              label: "OWNER PORTAL",
              items: [
                ["/app", "Overview", LayoutDashboard, ""],
                ["/app/properties", "Properties", House, ""],
                ["/app/compliance", "Compliance", ShieldCheck, ""],
                ["/app/owner", "Owner statements", ChartNoAxesCombined, ""],
                ["/app/documents", "Shared documents", Files, ""],
                ["/app/settings", "Settings", Settings, ""],
              ] as const,
            },
          ]
        : groups;
  return (
    <div className={`app-shell ${collapsed ? "compact" : ""}`}>
      <aside className={`sidebar ${open ? "mobile-open" : ""}`}>
        <Link href="/app" className="brand">
          <span className="brand-icon">
            <BrandIcon />
          </span>
          <span>{brand.name}</span>
        </Link>
        <button
          className="mobile-close icon-button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
        <label className="organisation-picker">
          <span className="org-avatar">{organisation.name[0]}</span>
          <select
            aria-label="Switch organisation"
            value={organisation.id}
            onChange={async (e) => {
              await requestJson("/api/organisation", "PATCH", {
                organisationId: e.target.value,
              });
              router.refresh();
            }}
          >
            {organisations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
        <nav aria-label="Main navigation">
          {visible.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items
                .filter(
                  (item) =>
                    !item[3] ||
                    role === "OWNER" ||
                    permissions.includes(`${item[3]}:read`) ||
                    permissions.includes(`${item[3]}:write`),
                )
                .map(([href, label, Icon]) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={pathname === href ? "page" : undefined}
                    className={`nav-item ${pathname === href || (href !== "/app" && pathname.startsWith(href + "/")) ? "active" : ""}`}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                    {href === "/app/repairs" && <span className="nav-dot" />}
                  </Link>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/help" className="nav-item">
            <HelpCircle size={18} />
            <span>Help & support</span>
            <ArrowUpRight size={14} />
          </Link>
          {admin && (
            <Link href="/admin" className="nav-item">
              <ShieldCheck size={18} />
              <span>Platform administration</span>
            </Link>
          )}
          <div className="profile">
            <span className="avatar">
              {userName
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span>
              <strong>{userName}</strong>
              <small>
                {role === "OWNER" ? "Organisation owner" : role.toLowerCase()}
              </small>
            </span>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={async () => {
                await authClient.signOut();
                router.push("/login");
                router.refresh();
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu size={21} />
          </button>
          <button
            className="icon-button desktop-toggle"
            aria-label="Toggle sidebar"
            onClick={() => setCollapsed(!collapsed)}
          >
            <PanelLeftClose size={18} />
          </button>
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>
              {pathname === "/app"
                ? "Overview"
                : pathname.split("/")[2].replaceAll("-", " ")}
            </strong>
          </div>
          <div className="header-right">
            {role !== "TENANT" && role !== "STAKEHOLDER" && (
              <form action="/app/properties" className="header-search">
                <Search size={16} />
                <input
                  name="q"
                  placeholder="Search properties…"
                  aria-label="Search properties"
                />
                <kbd>↵</kbd>
              </form>
            )}
            <span className="environment-pill">
              {process.env.NODE_ENV === "development"
                ? "Development"
                : "Workspace"}
            </span>
            <Link
              href="/app/notifications"
              className="notification-button"
              aria-label={`Notifications, ${unread ? "unread updates" : "no unread updates"}`}
            >
              <Bell size={19} />
              {unread && <span />}
            </Link>
            <Link href="/app/settings" className="avatar small-avatar">
              {userName[0]}
            </Link>
          </div>
        </header>
        <main className="content" id="main">
          {children}
        </main>
        <footer className="app-footer">
          <span>{brand.name}</span>
          <span>
            GBP · United Kingdom <span className="footer-dot" />{" "}
            <Link href="/privacy">Privacy</Link>
          </span>
        </footer>
      </div>
    </div>
  );
}
