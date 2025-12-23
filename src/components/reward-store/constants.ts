export const REWARD_EMOJIS = [
  "🎮",
  "🎬",
  "🍕",
  "🍦",
  "🎁",
  "🏊",
  "🎢",
  "🛹",
  "📱",
  "🎨",
  "⚽",
  "🎪",
  "🧸",
  "🎵",
  "📚",
  "🌟",
] as const;

export const LIMIT_OPTIONS = [
  { value: "none", labelKey: "limitNone" },
  { value: "daily", labelKey: "limitDaily" },
  { value: "weekly", labelKey: "limitWeekly" },
  { value: "monthly", labelKey: "limitMonthly" },
  { value: "once", labelKey: "limitOnce" },
] as const;
