/** Session-dependent: never prerendered, so `next build` needs no secrets. */
export const dynamic = 'force-dynamic';

/**
 * Shell for the account screens — sign-in, sign-up, and M14's invite flow.
 *
 * Deliberately *not* a guard. The "you already have a session, go to the app"
 * redirect lives on the sign-in and sign-up pages themselves, because it is
 * true of those two screens and false of the third: `invite/[token]` continues
 * past its own accept step with a freshly issued session, and a layout that
 * bounced every principal would eject the second parent from the middle of the
 * flow it just signed them into. Putting the rule where it applies is also the
 * honest shape — it was never a property of "being unauthenticated screens", it
 * was a property of those two forms.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      {children}
    </main>
  );
}
