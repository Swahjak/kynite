"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import authClient from "@/lib/auth-client";
import { defaultAuthRedirect } from "@/lib/auth-routes";

export function SignupForm() {
  const t = useTranslations("Auth");
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name) {
      toast.error(t("nameRequired"));
      return;
    }
    if (!email) {
      toast.error(t("emailRequired"));
      return;
    }
    if (!password) {
      toast.error(t("passwordRequired"));
      return;
    }
    if (password.length < 8) {
      toast.error(t("passwordMinLength"));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t("passwordMismatch"));
      return;
    }

    setIsLoading(true);

    try {
      const result = await authClient.signUp.email({
        name,
        email,
        password,
      });

      if (result.error) {
        toast.error(t("signupError"));
        return;
      }

      router.push(defaultAuthRedirect);
      router.refresh();
    } catch (error) {
      console.error("Signup error:", error);
      toast.error(t("signupError"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input
          id="name"
          type="text"
          placeholder="John Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading}
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
          autoComplete="new-password"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            {t("signingUp")}
          </>
        ) : (
          t("signupButton")
        )}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        {t("hasAccount")}{" "}
        <Link href="/login" className="text-primary hover:underline">
          {t("login")}
        </Link>
      </p>
    </form>
  );
}
