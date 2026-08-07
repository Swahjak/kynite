/**
 * Shared FR30 board-voice scan primitives, used by every namespace-specific
 * voice test (timers, notifications, and the M15 hub-wide checklist) so the
 * rule set and the walking/scanning logic live in exactly one place.
 *
 * Two rule tiers exist because two different surfaces carry two different
 * risks:
 *
 * - `HUB_RULES` — for board copy that may legitimately address the child in
 *   second person (praise: "Je hebt doorgezet!" / "You kept going!"). What
 *   FR30 actually forbids is a *parent's command* ("Doe je schoenen aan!")
 *   or *attribution* ("mama zegt"), not the board speaking to the child at
 *   all — a stated fact or a celebration is not a mouthpiece.
 * - `STRICT_RULES` (used by timers, the single most nagging-prone surface,
 *   and by notifications, which arrive uninvited) additionally forbids bare
 *   second-person address and any exclamation mark. Timers/notifications
 *   keep their own rule sets rather than switching to `HUB_RULES` — a
 *   countdown or a push body is closer to the "put your shoes on!" failure
 *   mode than a completion celebration is.
 */

export type Rule = { id: string; pattern: RegExp; why?: string };

export const PARENT_ATTRIBUTION: Record<'nl' | 'en', Rule> = {
  nl: {
    id: 'parent-attribution',
    pattern: /\b(?:mama|papa|mamma|pappa|moeder|vader)\b/i,
    why: 'the board never speaks for a parent (FR30)',
  },
  en: {
    id: 'parent-attribution',
    pattern: /\b(?:mom|mum|mommy|mummy|mother|dad|daddy|father)\b/i,
    why: 'the board never speaks for a parent (FR30)',
  },
};

export const IMPERATIVE: Record<'nl' | 'en', Rule> = {
  nl: {
    id: 'imperative',
    // Stem-form imperative a parent uses: "Doe …", "Ga …", "Pak …", at the
    // start of a sentence. Infinitive labels ("Stoppen", "Vragen") and past
    // participles ("gedaan", "gedoucht") are unaffected.
    pattern: /(?:^|[.!?]\s+)(?:doe|ga|pak|kom|zet|trek|schiet|stop|start|maak|ruim|vergeet)\b/i,
    why: 'a command a parent would give reads as the board giving orders',
  },
  en: {
    id: 'imperative',
    pattern: /(?:^|[.!?]\s+)(?:put|get|go|come|hurry|finish|clean|brush|pick|do not|don't)\b/i,
    why: 'a command a parent would give reads as the board giving orders',
  },
};

export const GUILT_FRAMING: Record<'nl' | 'en', Rule> = {
  nl: {
    id: 'guilt-framing',
    pattern: /\b(?:nog steeds niet|vergeten|weer niet|alweer|te laat|achterstand|gefaald)\b/i,
    why: 'a missed task is the absence of a row, never a reproach (research §Decisions 1)',
  },
  en: {
    id: 'guilt-framing',
    pattern: /\b(?:still (?:not|haven'?t)|forgot|again|too late|overdue|failed)\b/i,
    why: 'a missed task is the absence of a row, never a reproach (research §Decisions 1)',
  },
};

export const SECOND_PERSON: Record<'nl' | 'en', Rule> = {
  nl: { id: 'second-person', pattern: /\b(?:je|jij|jou|jouw|jullie|u|uw)\b/i },
  en: { id: 'second-person', pattern: /\b(?:you|your|yours|yourself)\b/i },
};

export const SHOUTING: Rule = { id: 'shouting', pattern: /!/ };

export const HUB_RULES: Record<'nl' | 'en', Rule[]> = {
  nl: [PARENT_ATTRIBUTION.nl, IMPERATIVE.nl, GUILT_FRAMING.nl],
  en: [PARENT_ATTRIBUTION.en, IMPERATIVE.en, GUILT_FRAMING.en],
};

export const STRICT_RULES: Record<'nl' | 'en', Rule[]> = {
  nl: [SECOND_PERSON.nl, IMPERATIVE.nl, SHOUTING],
  en: [SECOND_PERSON.en, IMPERATIVE.en, SHOUTING],
};

export type VoiceFinding = { path: string; rule: string; text: string };

/** Every string under a message subtree, with its dotted key path. */
export function stringsIn(
  node: unknown,
  path: string,
  out: [string, string][] = []
): [string, string][] {
  if (typeof node === 'string') {
    out.push([path, node]);
    return out;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) stringsIn(value, `${path}.${key}`, out);
  }
  return out;
}

export function scanVoice(
  rules: Record<'nl' | 'en', Rule[]>,
  locale: 'nl' | 'en',
  strings: readonly [string, string][]
): VoiceFinding[] {
  return strings.flatMap(([path, text]) =>
    rules[locale].flatMap((rule) =>
      rule.pattern.test(text) ? [{ path, rule: rule.id, text }] : []
    )
  );
}
