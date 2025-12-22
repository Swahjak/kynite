import { redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";

interface FamilyRequiredLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function FamilyRequiredLayout({
  children,
  params,
}: FamilyRequiredLayoutProps) {
  const { locale } = await params;
  const session = await getSession();

  // Not authenticated - middleware should have caught this, but double-check
  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  // No family - redirect to onboarding
  if (!session.session.familyId) {
    redirect(`/${locale}/onboarding`);
  }

  return <>{children}</>;
}
