import {
  ownerMemberOf,
  seedCompletions,
  seedEvents,
  seedMembers,
  seedRewards,
  seedRoutines,
  seedStars,
  withDb,
  type SeededMember,
  type SeededRoutine,
} from './seed';

/**
 * One representative household, seeded through the factory.
 *
 * The accessibility and celebration suites need *populated* surfaces — an
 * empty state has no routine cards to label, no star chart to describe and no
 * chips to reach by keyboard, so an axe run against a fresh family would pass
 * by having nothing on screen. This is the smallest household that renders
 * every component those suites are about: two children (so the selector chips
 * exist), a routine part-done today, a reward shelf with one affordable and one
 * out-of-reach item, and an event on the board.
 *
 * Every field is generated per call. Nothing here is shared between tests —
 * that is what lets the suite run `--repeat-each=2` in a shuffled order.
 */

export type SeededHousehold = {
  owner: SeededMember;
  children: SeededMember[];
  routine: SeededRoutine;
  eventTitle: string;
};

export async function seedHousehold(familyId: string, occurrenceDate: string) {
  return withDb(async (client): Promise<SeededHousehold> => {
    const owner = await ownerMemberOf(client, familyId);

    const children = await seedMembers(client, familyId, [
      { displayName: 'Mila', role: 'child', color: 'purple', sortOrder: 1 },
      { displayName: 'Daan', role: 'child', color: 'orange', sortOrder: 2 },
    ]);

    const [routine] = await seedRoutines(client, familyId, [
      {
        title: 'Klaarmaken voor school',
        ownerMemberId: children[0].id,
        icon: 'wb_sunny',
        schedule: { rrule: 'FREQ=DAILY', timeOfDay: '07:30' },
        starsPerCompletion: 2,
        steps: [
          { title: 'Bed opmaken' },
          { title: 'Tanden poetsen', timerSeconds: 120 },
          { title: 'Aankleden' },
        ],
      },
    ]);

    // One step already done, so the done treatment (praise + star) is on screen
    // next to two todo steps.
    await seedCompletions(client, familyId, children[0].id, [
      { routineId: routine.id, routineStepId: routine.stepIds[0], occurrenceDate },
    ]);

    await seedStars(client, familyId, children[0].id, [{ amount: 12 }]);
    await seedStars(client, familyId, children[1].id, [{ amount: 3 }]);

    await seedRewards(client, familyId, [
      { title: 'Extra verhaaltje', costStars: 5, category: 'privilege', icon: 'menu_book' },
      { title: 'Naar de dierentuin', costStars: 40, category: 'experience', icon: 'pets' },
    ]);

    const eventTitle = 'Zwemles';
    // One event on either side of the axe suite's pinned clock (12:00), so the
    // *past* treatment is audited too — that is where M17 found the hub board's
    // only real contrast failure.
    await seedEvents(client, familyId, [
      {
        title: 'Tandarts',
        startsAt: `${occurrenceDate}T08:00:00Z`,
        endsAt: `${occurrenceDate}T09:00:00Z`,
        ownerMemberId: children[0].id,
        attendeeMemberIds: [children[0].id],
      },
      {
        title: eventTitle,
        startsAt: `${occurrenceDate}T15:00:00Z`,
        endsAt: `${occurrenceDate}T16:00:00Z`,
        ownerMemberId: children[0].id,
        attendeeMemberIds: [children[0].id],
      },
    ]);

    return { owner, children, routine, eventTitle };
  });
}
