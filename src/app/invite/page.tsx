import { AcceptInvite } from "@/components/invite";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return <AcceptInvite token={(await searchParams).token || ""} />;
}
