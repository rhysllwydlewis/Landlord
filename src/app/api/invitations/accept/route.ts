import { csrf } from "@/server/context";
import { apiError } from "@/server/errors";
import { acceptInvitation } from "@/server/onboarding";
import { cookies } from "next/headers";
export async function POST(request: Request) {
  try {
    await csrf(request);
    const r = await acceptInvitation(await request.json());
    (await cookies()).set("organisation", r.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return Response.json(r);
  } catch (e) {
    return apiError(e);
  }
}
