import { InteractionModeProvider } from "@/contexts/interaction-mode-context";

export default function WallLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InteractionModeProvider mode="wall">{children}</InteractionModeProvider>
  );
}
