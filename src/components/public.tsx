import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { brand } from "@/lib/config";
import { BrandIcon } from "./ui";
import type { ReactNode } from "react";
import { HomeNavigation } from "./home/navigation";
export function PublicLayout({
  children,
  premium = false,
}: {
  children: ReactNode;
  premium?: boolean;
}) {
  return (
    <div className={`public-site${premium ? " premium-site" : ""}`}>
      {premium ? (
        <HomeNavigation name={brand.name} logo={brand.logo} />
      ) : (
        <header className="public-header">
          <Link href="/" className="brand">
            <span className="brand-icon">
              <BrandIcon />
            </span>
            <span>{brand.name}</span>
          </Link>
          <nav aria-label="Public navigation">
            <Link href="/features">Features</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/about">About</Link>
            <Link href="/help">Help</Link>
          </nav>
          <div className="public-header-actions">
            <Link href="/login" className="text-link">
              Sign in
            </Link>
            <Link href="/register" className="button primary">
              Get started <ArrowUpRight size={15} />
            </Link>
          </div>
        </header>
      )}
      {children}
      <footer className="public-footer">
        <div>
          <Link href="/" className="brand">
            <Image src={brand.logo} width={24} height={24} alt="" />
            {brand.name}
          </Link>
          <p>A clearer way to manage your rental business.</p>
          <small>
            {brand.company ||
              (premium
                ? "Pre-launch platform. Product name and pricing may change."
                : "Temporary product name. Company details will be configured before launch.")}
          </small>
        </div>
        <div>
          <strong>Platform</strong>
          <Link href="/features">Features</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/listings">Rental listings</Link>
        </div>
        <div>
          <strong>Company</strong>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/help">Help & support</Link>
        </div>
        <div>
          <strong>Legal</strong>
          <Link href="/privacy">Privacy notice</Link>
          <Link href="/terms">Terms of service</Link>
          <Link href="/cookies">Cookies</Link>
        </div>
      </footer>
    </div>
  );
}
