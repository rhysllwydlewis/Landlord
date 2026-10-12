import Link from "next/link";
import { House } from "lucide-react";
import { PublicLayout } from "@/components/public";
import { db } from "@/server/db";
import { money, date } from "@/lib/calculations";
export const dynamic = "force-dynamic";
export default async function Page() {
  const listings = await db.listing.findMany({
    where: {
      published: true,
      property: { archivedAt: null, organisation: { status: "active" } },
    },
    take: 30,
    orderBy: { createdAt: "desc" },
    select: {
      slug: true,
      title: true,
      rentPence: true,
      availableAt: true,
      property: { select: { postcode: true, bedrooms: true, type: true } },
    },
  });
  return (
    <PublicLayout>
      <main className="public-section prose-page" id="main">
        <span className="eyebrow">FIND YOUR NEXT HOME</span>
        <h1>Available properties.</h1>
        <p>Listings published directly by property managers.</p>
        <div className="listing-grid">
          {listings.map((l) => (
            <article className="listing-card" key={l.slug}>
              <House size={45} strokeWidth={1} />
              <h2>{l.title}</h2>
              <p>
                {l.property.postcode} · {l.property.bedrooms} bedrooms
                <br />
                Available {date(l.availableAt)}
              </p>
              <strong className="price">
                {money(l.rentPence)}
                <small> / month</small>
              </strong>
              <Link className="button primary" href={`/listings/${l.slug}`}>
                View property
              </Link>
            </article>
          ))}
        </div>
        {!listings.length && (
          <p>No published properties are currently available.</p>
        )}
      </main>
    </PublicLayout>
  );
}
