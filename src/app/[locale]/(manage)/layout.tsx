import { InteractionModeProvider } from "@/contexts/interaction-mode-context";

export default function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InteractionModeProvider mode="manage">{children}</InteractionModeProvider>
  );
}
