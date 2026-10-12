import { notFound } from "next/navigation";
import { context } from "@/server/context";
import { options } from "@/server/dashboard";
import { getRepair } from "@/server/repairs";
import { RepairDetail } from "@/components/repair-detail";
export default async function RepairPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await context();
  let repair;
  try {
    repair = await getRepair(ctx, (await params).id);
  } catch {
    notFound();
  }
  return (
    <RepairDetail
      repair={JSON.parse(JSON.stringify(repair))}
      options={await options(ctx)}
      tenant={ctx.role === "TENANT"}
      editable={
        ctx.role === "OWNER" ||
        (ctx.role === "STAFF" && ctx.permissions.includes("repairs:write"))
      }
    />
  );
}
