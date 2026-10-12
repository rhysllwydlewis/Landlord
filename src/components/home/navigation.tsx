"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
const links = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];
export function HomeNavigation({ name, logo }: { name: string; logo: string }) {
  const header = useRef<HTMLElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const toggle = useRef<HTMLElement>(null);
  function close() {
    if (menu.current) menu.current.open = false;
  }
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 760px)");
    const resize = () => {
      if (!mobile.matches) close();
    };
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !header.current?.contains(event.target)
      )
        close();
    };
    resize();
    mobile.addEventListener("change", resize);
    document.addEventListener("pointerdown", outside);
    return () => {
      mobile.removeEventListener("change", resize);
      document.removeEventListener("pointerdown", outside);
    };
  }, []);
  return (
    <header
      ref={header}
      className="home-navigation glass"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menu.current?.open) {
          event.preventDefault();
          close();
          if (toggle.current?.getClientRects().length) toggle.current.focus();
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
        <details className="home-mobile-menu" ref={menu}>
          <summary
            ref={toggle}
            role="button"
            className="home-menu-button"
            aria-controls="home-mobile-menu"
          >
            <Menu size={20} className="home-menu-open" aria-hidden="true" />
            <X size={20} className="home-menu-close" aria-hidden="true" />
            <span className="sr-only home-menu-open">Open menu</span>
            <span className="sr-only home-menu-close">Close menu</span>
          </summary>
          <nav
            id="home-mobile-menu"
            className="home-mobile-nav"
            aria-label="Mobile navigation"
          >
            {[
              ...links,
              { href: "/login", label: "Sign in" },
              { href: "/help", label: "Help & support" },
            ].map((link) => (
              <Link key={link.href} href={link.href} onClick={close}>
                {link.label}
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}
