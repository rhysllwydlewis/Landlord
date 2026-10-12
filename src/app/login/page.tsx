import { AuthForm } from "@/components/auth-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  return <AuthForm mode="login" invite={(await searchParams).invite} />;
}
