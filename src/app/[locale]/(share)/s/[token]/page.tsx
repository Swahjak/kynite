export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <main className="p-8">Caregiver share view for {token} — implemented in M13.</main>;
}
