import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getSession } from "@/lib/get-session";
import { getUserFamily } from "@/server/services/family-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import Link from "next/link";

interface CompletePageProps {
  params: Promise<{ locale: string }>;
}

export default async function CompletePage({ params }: CompletePageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const family = await getUserFamily(session.user.id);

  if (!family) {
    redirect(`/${locale}/onboarding/create`);
  }

  // No cookie needed - session now includes familyId via customSession

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
          <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <CardTitle className="text-2xl">All Set!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-muted-foreground">
          Your family &ldquo;{family.name}&rdquo; is ready to go.
        </p>
        <Button asChild className="w-full">
          <Link href={`/${locale}/calendar`}>Go to Calendar</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
