// Fixture for `tests/unit/no-negative-marking.test.ts`. Every line below is a
// thing the product must never ship — one per rule the scanner enforces, so a
// scanner that silently stopped matching would fail this file instead of
// passing the real one. Excluded from `pnpm lint` and from `tsconfig.json`.

export function BadStepRow() {
  return (
    <div>
      <Icon name="close" />
      <span className="text-destructive">Missed</span>
      <span>-1 star</span>
      <span>Streak lost</span>
      <span>Leaderboard: Mila beats Daan</span>
    </div>
  );
}

declare function Icon(props: { name: string }): JSX.Element;
