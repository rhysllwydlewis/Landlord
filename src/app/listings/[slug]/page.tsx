import { notFound } from "next/navigation";
import { House } from "lucide-react";
import { db } from "@/server/db";
import { PublicLayout } from "@/components/public";
import { ApplicationForm } from "@/components/application-form";
import { money, date } from "@/lib/calculations";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const l = await db.listing.findFirst({
    where: {
      slug: (await params).slug,
      published: true,
      property: { archivedAt: null, organisation: { status: "active" } },
    },
    select: {
      id: true,
      title: true,
      description: true,
      rentPence: true,
      depositPence: true,
      availableAt: true,
      property: {
        select: {
          postcode: true,
          bedrooms: true,
          bathrooms: true,
          epcRating: true,
          type: true,
        },
      },
    },
  });
  if (!l) notFound();
  return (
    <PublicLayout>
      <main className="public-section prose-page" id="main">
        <House size={50} strokeWidth={1} />
        <h1>{l.title}</h1>
        <p>
          {l.property.postcode} · {l.property.bedrooms} bedrooms ·{" "}
          {l.property.bathrooms} bathrooms · EPC{" "}
          {l.property.epcRating || "not recorded"}
        </p>
        <strong className="price">
          {money(l.rentPence)}
          <small> per month</small>
        </strong>
        <p>
          Deposit: {money(l.depositPence)} · Available {date(l.availableAt)}
        </p>
        <section>
          <p className="preserve-text">{l.description}</p>
        </section>
        <ApplicationForm listingId={l.id} />
      </main>
    </PublicLayout>
  );
}
