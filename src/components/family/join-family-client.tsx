"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, AlertCircle, Users } from "lucide-react";

interface JoinFamilyClientProps {
  token: string;
  locale: string;
}

interface InviteValidation {
  valid: boolean;
  familyName?: string;
  familyId?: string;
  reason?: string;
}

export function JoinFamilyClient({ token, locale }: JoinFamilyClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [validation, setValidation] = useState<InviteValidation | null>(null);

  useEffect(() => {
    async function validateInvite() {
      try {
        const response = await fetch(`/api/v1/invites/${token}`);
        const result = await response.json();

        if (result.success) {
          setValidation(result.data);
        } else {
          setValidation({ valid: false, reason: result.error?.message });
        }
      } catch (error) {
        setValidation({ valid: false, reason: "Failed to validate invite" });
      } finally {
        setIsLoading(false);
      }
    }

    validateInvite();
  }, [token]);

  async function handleJoin() {
    setIsJoining(true);

    try {
      const response = await fetch(`/api/v1/invites/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (!result.success) {
        if (result.error?.code === "ALREADY_MEMBER") {
          toast.info("You are already a member of this family");
          router.push(`/${locale}/calendar`);
          return;
        }
        toast.error(result.error?.message || "Failed to join family");
        return;
      }

      toast.success(`Welcome to ${result.data.family.name}!`);
      router.push(`/${locale}/onboarding/complete`);
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setIsJoining(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!validation?.valid) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
            <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl">Invalid Invite</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            {validation?.reason || "This invite link is not valid"}
          </p>
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push(`/${locale}/onboarding`)}
          >
            Create Your Own Family
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
          <Users className="h-10 w-10 text-blue-600 dark:text-blue-400" />
        </div>
        <CardTitle className="text-2xl">Join Family</CardTitle>
        <CardDescription>You&apos;ve been invited to join</CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-xl font-semibold">{validation.familyName}</p>
      </CardContent>
      <CardFooter>
        <Button onClick={handleJoin} disabled={isJoining} className="w-full">
          {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Join Family
        </Button>
      </CardFooter>
    </Card>
  );
}
