import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { getUserFamily, getFamilyMembers } from "@/server/services/family-service";
import { getChoresForFamily, getChoreProgress } from "@/server/services/chore-service";
import { Chores, ChoresProvider } from "@/components/chores";

export default async function ChoresPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const family = await getUserFamily(session.user.id);
  if (!family) {
    redirect("/families/create");
  }

  const [chores, progress, members] = await Promise.all([
    getChoresForFamily(family.id, { status: "pending" }),
    getChoreProgress(family.id),
    getFamilyMembers(family.id),
  ]);

  return (
    <div className="container max-w-4xl py-8">
      <ChoresProvider
        familyId={family.id}
        initialChores={chores}
        initialProgress={progress}
        members={members}
      >
        <Chores familyName={family.name} />
      </ChoresProvider>
    </div>
  );
}
