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

  // DEBUG: Log session state
  console.log("[AuthLayout] Session check:", {
    hasSession: !!session,
    hasUser: !!session?.user,
    userId: session?.user?.id,
    email: session?.user?.email,
  });

  // Not authenticated - redirect to login
  if (!session?.user) {
    console.log("[AuthLayout] No user in session, redirecting to login");
    redirect(`/${locale}/login`);
  }

  return <>{children}</>;
}
