"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DeviceDisconnectedProps {
  locale: string;
}

export function DeviceDisconnected({ locale }: DeviceDisconnectedProps) {
  const t = useTranslations("DeviceDisconnected");
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="bg-destructive/10 mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
            <WifiOff className="text-destructive size-8" />
          </div>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => router.push(`/${locale}/device/pair`)}
            className="w-full"
          >
            {t("pairAgain")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
