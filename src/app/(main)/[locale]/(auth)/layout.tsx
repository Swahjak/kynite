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

  // Middleware handles auth redirect, but keep as fallback
  const session = await getSession();
  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  return <>{children}</>;
}
