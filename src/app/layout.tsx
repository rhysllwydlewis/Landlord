import type { Metadata } from "next";
import type { ReactNode, CSSProperties } from "react";
import { brand } from "@/lib/config";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: brand.name, template: `%s | ${brand.name}` },
  description:
    "A connected workspace for UK landlords and tenants. Properties, rent, repairs and documents.",
  icons: { icon: brand.favicon },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB">
      <body style={{ "--accent": brand.accent } as CSSProperties}>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
