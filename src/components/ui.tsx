import Link from "next/link";
import Image from "next/image";
import { brand } from "@/lib/config";
import { ArrowUpRight, Plus, Inbox } from "lucide-react";
import type { ReactNode } from "react";
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({
  title = "Nothing here yet",
  description = "Add your first record to get started.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Inbox size={25} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ViewLink({
  href,
  children = "View all",
}: {
  href: string;
  children?: ReactNode;
}) {
  return (
    <Link className="text-link" href={href}>
      {children}
      <ArrowUpRight size={14} />
    </Link>
  );
}
export function AddLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link className="button primary" href={href}>
      <Plus size={16} />
      {children}
    </Link>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <Badge
      tone={
        [
          "paid",
          "active",
          "resolved",
          "closed",
          "completed",
          "shared",
          "scheme recorded",
        ].includes(value)
          ? "green"
          : ["overdue", "emergency", "expired", "high", "declined"].includes(
                value,
              )
            ? "red"
            : ["private", "draft", "cancelled"].includes(value)
              ? "neutral"
              : "amber"
      }
    >
      <span className="status-dot" />
      {value}
    </Badge>
  );
}

export function BrandIcon() {
  return <Image src={brand.logo} width={25} height={25} alt="" />;
}
