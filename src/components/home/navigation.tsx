"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
const links = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];
export function HomeNavigation({ name, logo }: { name: string; logo: string }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  return (
    <header
      className="home-navigation glass"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <Link href="/" className="home-brand" aria-label={`${name} home`}>
        <span className="home-brand-icon">
          <Image src={logo} width={25} height={25} alt="" />
        </span>
        <span>{name}</span>
      </Link>
      <nav className="home-desktop-nav" aria-label="Public navigation">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="home-nav-actions">
        <Link href="/login" className="home-signin">
          Sign in
        </Link>
        <Link href="/register" className="home-button home-button-small">
          Get started <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
        <button
          ref={toggle}
          className="home-menu-button"
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="home-mobile-menu"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      <nav
        id="home-mobile-menu"
        className="home-mobile-nav"
        aria-label="Mobile navigation"
        hidden={!open}
      >
        {[
          ...links,
          { href: "/login", label: "Sign in" },
          { href: "/help", label: "Help & support" },
        ].map((link) => (
          <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
            {link.label}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </header>
  );
}
