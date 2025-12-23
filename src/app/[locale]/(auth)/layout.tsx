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

  // DEBUG: Throw error with session info instead of redirecting
  const session = await getSession();
  if (!session?.user) {
    // Temporarily show error page instead of redirect to see what's happening
    throw new Error(
      `Session check failed. Has session object: ${!!session}, BETTER_AUTH_URL: ${process.env.BETTER_AUTH_URL}`
    );
  }

  return <>{children}</>;
}
