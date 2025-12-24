"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DevicePairFormProps {
  locale: string;
}

export function DevicePairForm({ locale }: DevicePairFormProps) {
  const t = useTranslations("DevicePairPage");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/devices/pair/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(
          data.error?.code === "INVALID_CODE" ? t("invalidCode") : t("error")
        );
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/${locale}/dashboard`);
      }, 2000);
    } catch {
      setError(t("error"));
      setIsLoading(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(value);
    setError(null);
  };

  if (success) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <div className="text-primary mb-4 text-4xl">✓</div>
          <h2 className="mb-2 text-xl font-semibold">{t("success")}</h2>
          <p className="text-muted-foreground">{t("redirecting")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="bg-primary/10 mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
          <Tablet className="text-primary size-8" />
        </div>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={handleCodeChange}
            placeholder={t("codePlaceholder")}
            className="text-center text-2xl tracking-widest"
            disabled={isLoading}
            autoFocus
          />

          {error && (
            <p className="text-destructive text-center text-sm">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={code.length !== 6 || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t("pairing")}
              </>
            ) : (
              t("pair")
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
