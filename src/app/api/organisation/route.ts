import { csrf, sessionUser } from "@/server/context";
import { apiError, invariant } from "@/server/errors";
import { createOrganisation } from "@/server/onboarding";
import { db } from "@/server/db";
import { cookies } from "next/headers";
export async function POST(request: Request) {
  try {
    await csrf(request);
    const result = await createOrganisation(await request.json());
    (await cookies()).set("organisation", result.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return Response.json(result, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(request: Request) {
  try {
    await csrf(request);
    const user = await sessionUser();
    const { organisationId } = await request.json();
    invariant(
      typeof organisationId === "string" &&
        (await db.membership.findFirst({
          where: { organisationId, userId: user.id, active: true },
        })),
      403,
      "Organisation unavailable.",
    );
    (await cookies()).set("organisation", organisationId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
