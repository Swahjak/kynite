import { redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";

interface AuthLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AuthLayout({
  children,
  params,
}: AuthLayoutProps) {
  const { locale } = await params;
  const session = await getSession();

  // Not authenticated - redirect to login
  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  return <>{children}</>;
}
