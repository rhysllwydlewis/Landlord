import { notFound } from "next/navigation";
import { context } from "@/server/context";
import { options } from "@/server/dashboard";
import { getRepair } from "@/server/repairs";
import { RepairDetail } from "@/components/repair-detail";
import { featureAvailable } from "@/server/entitlements";
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
      feedbackEnabled={
        ctx.role === "TENANT" && (await featureAvailable(ctx, "operations"))
      }
      financeEditable={
        ctx.role === "OWNER" ||
        (ctx.role === "STAFF" && ctx.permissions.includes("finance:write"))
      }
      documentEditable={
        ctx.role === "OWNER" ||
        (ctx.role === "STAFF" && ctx.permissions.includes("documents:write"))
      }
      editable={
        ctx.role === "OWNER" ||
        (ctx.role === "STAFF" && ctx.permissions.includes("repairs:write"))
      }
    />
  );
}
