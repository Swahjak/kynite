"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";

type TokenState =
  | "loading"
  | "valid"
  | "invalid"
  | "linking"
  | "success"
  | "error";

interface TokenValidationResponse {
  success: boolean;
  data?: {
    valid: boolean;
    expiresAt?: string;
    reason?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

interface LinkAccountResponse {
  success: boolean;
  data?: {
    userId: string;
    email: string;
    name: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export default function LinkAccountClient() {
  const t = useTranslations("LinkAccount");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<TokenState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setState("invalid");
      setErrorMessage(t("invalidDescription"));
      return;
    }

    async function validateToken() {
      try {
        const response = await fetch(
          `/api/v1/link-account?token=${encodeURIComponent(token!)}`
        );
        const data: TokenValidationResponse = await response.json();

        if (!data.success || !data.data?.valid) {
          setState("invalid");
          setErrorMessage(data.data?.reason || t("invalidDescription"));
        } else {
          setState("valid");
          if (data.data.expiresAt) {
            setExpiresAt(new Date(data.data.expiresAt));
          }
        }
      } catch (error) {
        console.error("Error validating token:", error);
        setState("invalid");
        setErrorMessage(t("invalidDescription"));
      }
    }

    validateToken();
  }, [token, t]);

  const handleLinkAccount = async () => {
    if (!token) return;

    setState("linking");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/v1/link-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data: LinkAccountResponse = await response.json();

      if (data.success) {
        setState("success");
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
      } else {
        setState("error");
        // Handle specific error codes
        if (data.error?.code === "ALREADY_EXISTS") {
          setErrorMessage(t("emailInUseDescription"));
        } else if (data.error?.code === "AUTH_EXPIRED") {
          setErrorMessage(t("expiredDescription"));
        } else if (data.error?.code === "NOT_FOUND") {
          setErrorMessage(t("invalidDescription"));
        } else {
          setErrorMessage(data.error?.message || t("errorDescription"));
        }
      }
    } catch (error) {
      console.error("Error linking account:", error);
      setState("error");
      setErrorMessage(t("errorDescription"));
    }
  };

  const getTimeRemaining = () => {
    if (!expiresAt) return null;

    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();

    if (diff <= 0) return null;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours} ${t("hours")}`;
    }
    return `${minutes} ${t("minutes")}`;
  };

  return (
    <div className="container flex min-h-screen items-center justify-center py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-4 flex items-center justify-center">
            {state === "loading" && (
              <Loader2 className="text-primary h-12 w-12 animate-spin" />
            )}
            {state === "valid" && (
              <CheckCircle className="h-12 w-12 text-green-500" />
            )}
            {state === "invalid" && (
              <XCircle className="text-destructive h-12 w-12" />
            )}
            {state === "linking" && (
              <Loader2 className="text-primary h-12 w-12 animate-spin" />
            )}
            {state === "success" && (
              <CheckCircle className="h-12 w-12 text-green-500" />
            )}
            {state === "error" && (
              <AlertCircle className="text-destructive h-12 w-12" />
            )}
          </div>

          <CardTitle className="text-center">
            {state === "loading" && t("loading")}
            {state === "valid" && t("validToken")}
            {state === "invalid" && t("invalidToken")}
            {state === "linking" && t("linking")}
            {state === "success" && t("success")}
            {state === "error" && t("error")}
          </CardTitle>

          <CardDescription className="text-center">
            {state === "loading" && t("description")}
            {state === "valid" && t("validDescription")}
            {state === "invalid" && (errorMessage || t("invalidDescription"))}
            {state === "linking" && t("description")}
            {state === "success" && t("successDescription")}
            {state === "error" && (errorMessage || t("errorDescription"))}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {state === "valid" && (
            <div className="space-y-4">
              {expiresAt && getTimeRemaining() && (
                <p className="text-muted-foreground text-center text-sm">
                  {t("expiresIn")} {getTimeRemaining()}
                </p>
              )}
              <Button onClick={handleLinkAccount} className="w-full" size="lg">
                {t("linkButton")}
              </Button>
            </div>
          )}

          {state === "success" && (
            <div className="text-center">
              <p className="text-muted-foreground text-sm">
                {t("successRedirect")}
              </p>
            </div>
          )}

          {(state === "invalid" || state === "error") && (
            <Button
              onClick={() => router.push("/")}
              className="w-full"
              variant="outline"
            >
              {t("backToHome")}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
