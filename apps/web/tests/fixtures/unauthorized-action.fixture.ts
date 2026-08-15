'use server';

// Fixture: an unauthorized Server Action. `server-action-authorization.test.ts`
// runs its checker over this file and must report a violation — that is what
// proves the repo-wide check is not vacuous.
// Excluded from `pnpm lint` and from `tsconfig.json`; the imports below do not
// resolve on purpose.
import { getDb } from '@/server/db';
import { member } from '@/modules/family/schema';

export async function renameEveryoneAction(name: string): Promise<void> {
  const db = getDb();
  await db.update(member).set({ displayName: name });
}

/** @public-action pretend justification */
export async function sneakyExemptAction(): Promise<void> {
  const db = getDb();
  await db.delete(member);
}

// `export const x = async () => {}` is the shape most real Server Actions in
// this repo actually take. The auditor must walk these too — a checker that
// only understands `function` declarations would never see this one.
export const renameEveryoneArrowAction = async (name: string): Promise<void> => {
  const db = getDb();
  await db.update(member).set({ displayName: name });
};

// `export const x = async function () {}` — same blind spot, function-expression
// flavor.
export const renameEveryoneFunctionExpressionAction = async function (name: string): Promise<void> {
  const db = getDb();
  await db.update(member).set({ displayName: name });
};
