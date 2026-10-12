import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function apiError(error: unknown): Response {
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      { error: "Please check the form.", fields: error.flatten().fieldErrors },
      { status: 422 },
    );
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P2002", "P2003", "P2034"].includes(error.code)
  )
    return Response.json(
      {
        error:
          "This record conflicts with existing data. Refresh and try again.",
      },
      { status: 409 },
    );
  console.error("Request failed", {
    type: error instanceof Error ? error.name : "Unknown",
  });
  return Response.json(
    { error: "The request could not be completed. Please try again." },
    { status: 500 },
  );
}
export function invariant(
  condition: unknown,
  status: number,
  message: string,
): asserts condition {
  if (!condition) throw new AppError(status, message);
}
