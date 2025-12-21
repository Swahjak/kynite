import Link from "next/link";

export default function Home() {
  return (
    <main className="bg-background flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold">Family Planner</h1>
      <p className="text-muted-foreground">
        Your family&apos;s organizational hub
      </p>
      <Link
        href="/calendar"
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-3"
      >
        Open Calendar
      </Link>
    </main>
  );
}
