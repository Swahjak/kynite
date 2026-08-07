import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * Repo-wide enforcement of docs/architecture.md §7: *every* Server Action goes
 * through the `can()` chokepoint before it touches data.
 *
 * The check is static (TypeScript AST) and structural: for each exported
 * function in a `'use server'` module it demands an `assertCan(...)` / `can(...)`
 * call in a statement that precedes the first statement referencing the
 * database. Actions that legitimately have no principal — sign-up, sign-in,
 * sign-out — must carry a `@public-action` JSDoc tag *and* appear in the
 * allowlist below, so a new exemption cannot be added quietly.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** The complete set of Server Actions that may skip authorization. */
const PUBLIC_ACTIONS = [
  'src/modules/family/actions.ts::signUpAction',
  'src/modules/family/actions.ts::signInAction',
  'src/modules/family/actions.ts::signOutAction',
  // M12. The kiosk pairing exchange is the same class of thing as sign-in: it
  // *establishes* a credential, so there is no principal for `assertCan` to
  // check. The six-digit code is the authorization, and everything that makes
  // it one (10-minute TTL, single use, one family) is enforced by the claiming
  // UPDATE in `modules/devices/queries.ts`.
  'src/modules/devices/actions.ts::pairDeviceAction',
  // M14. Same class again, and the strictest case of it: accepting a
  // second-parent invite *creates* the principal it would otherwise be checked
  // against. The 32-byte token is the authorization, and every property that
  // makes it one — single use, unexpired, unrevoked, pointing at a member row
  // that still has no login — is the WHERE clause of the claiming UPDATE in
  // `modules/family/invites.ts`, so there is no check here to race against.
  'src/modules/family/actions.ts::acceptInviteAction',
  // M19 phase 2. Google social sign-in, both halves. `signInWithGoogleAction`
  // is `signInAction` by another route — it hands the browser to Google's
  // consent screen and establishes the principal on the way back, so there is
  // none to check on the way out; the PKCE verifier and the signed `state`
  // better-auth mints are what make the round trip safe, and the one
  // attacker-controlled value it touches (`callbackUrl`) is refused unless
  // `sanitizeCallbackUrl` says it is a same-origin path.
  'src/modules/family/actions.ts::signInWithGoogleAction',
  // The other half: a Google account arrives with a session and *no* household,
  // which is the one state that resolves to no principal at all. This action
  // creates it, so `assertCan` has nothing to check — its authorization is the
  // better-auth session cookie it reads first, and it refuses without one.
  'src/modules/family/actions.ts::createFamilyForSocialUserAction',
];

const AUTHORIZATION_CALLS = new Set(['can', 'assertCan', 'decide']);
const DATA_ACCESS = new Set(['getDb', 'db', 'tx', 'getAuth', 'auth']);

type Finding = {
  id: string;
  exempt: boolean;
  violation: string | null;
};

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collectSourceFiles(path, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

function isServerActionModule(text: string): boolean {
  return /^\s*(['"])use server\1\s*;/.test(text);
}

/** Identifiers referenced anywhere inside a node. */
function identifiersIn(node: ts.Node): Set<string> {
  const names = new Set<string>();
  const visit = (child: ts.Node) => {
    if (ts.isIdentifier(child)) names.add(child.text);
    ts.forEachChild(child, visit);
  };
  visit(node);
  return names;
}

function calleeNamesIn(node: ts.Node): Set<string> {
  const names = new Set<string>();
  const visit = (child: ts.Node) => {
    if (ts.isCallExpression(child) && ts.isIdentifier(child.expression)) {
      names.add(child.expression.text);
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return names;
}

function hasPublicTag(node: ts.Node, text: string): boolean {
  const comments = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
  return comments.some((range) => text.slice(range.pos, range.end).includes('@public-action'));
}

function isExportedStatement(statement: ts.Statement): boolean {
  return (
    ts.canHaveModifiers(statement) &&
    (ts
      .getModifiers(statement)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
      false)
  );
}

/**
 * A named, exported, block-bodied function at the top level of a module.
 * Covers `export function f() {}`, `export const f = () => {}`, and
 * `export const f = async function () {}` — the three shapes Server Actions
 * take in this repo. `commentNode` is what JSDoc/`@public-action` is read off
 * of: for a `const`, the doc comment sits above the `VariableStatement`, not
 * the initializer.
 */
type NamedFunction = {
  functionName: string;
  commentNode: ts.Node;
  body: ts.NodeArray<ts.Statement>;
};

function namedFunctionsIn(statement: ts.Statement): NamedFunction[] {
  if (!isExportedStatement(statement)) return [];

  if (ts.isFunctionDeclaration(statement)) {
    if (!statement.body || !statement.name) return [];
    return [
      {
        functionName: statement.name.text,
        commentNode: statement,
        body: statement.body.statements,
      },
    ];
  }

  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((declaration): NamedFunction[] => {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) return [];
      const init = declaration.initializer;
      const isFunctionLike = ts.isArrowFunction(init) || ts.isFunctionExpression(init);
      if (!isFunctionLike || !ts.isBlock(init.body)) return [];

      return [
        { functionName: declaration.name.text, commentNode: statement, body: init.body.statements },
      ];
    });
  }

  return [];
}

/**
 * Every exported, top-level, block-bodied function of a `'use server'`
 * module, audited — `function` declarations *and* `const f = () => {}` /
 * `const f = async function () {}` assignments alike (docs/architecture.md
 * §7's `assertCan()` chokepoint applies regardless of which shape a Server
 * Action is written in).
 */
export function auditServerActions(filePath: string, text: string): Finding[] {
  const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.ESNext, true);
  const id = relative(root, filePath);

  return source.statements.flatMap((statement): Finding[] =>
    namedFunctionsIn(statement).map(({ functionName, commentNode, body }): Finding => {
      const name = `${id}::${functionName}`;
      const exempt = hasPublicTag(commentNode, text);

      const authIndex = body.findIndex((line) =>
        [...calleeNamesIn(line)].some((callee) => AUTHORIZATION_CALLS.has(callee))
      );
      const dataIndex = body.findIndex((line) =>
        [...identifiersIn(line)].some((identifier) => DATA_ACCESS.has(identifier))
      );

      let violation: string | null = null;
      if (!exempt) {
        if (authIndex === -1) {
          violation = `${name} never calls can()/assertCan()`;
        } else if (dataIndex !== -1 && dataIndex < authIndex) {
          violation = `${name} touches data before it authorizes`;
        }
      }

      return { id: name, exempt, violation };
    })
  );
}

/**
 * A function-body-level `'use server'` directive (the per-function flavor
 * Next.js also supports) is invisible to `auditServerActions()`, which only
 * walks the top level of files that open with a *module*-level `'use server'`
 * directive. Nothing in this repo uses that shape today; this catches the day
 * someone reaches for it before the auditor is taught to see it.
 */
function functionLevelUseServerDirectives(sourceFile: ts.SourceFile): string[] {
  const hits: string[] = [];

  const bodyOpensWithUseServer = (body: ts.ConciseBody | undefined): boolean => {
    if (!body || !ts.isBlock(body)) return false;
    const first = body.statements[0];
    return (
      !!first &&
      ts.isExpressionStatement(first) &&
      ts.isStringLiteral(first.expression) &&
      first.expression.text === 'use server'
    );
  };

  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && bodyOpensWithUseServer(node.body)) {
      hits.push(node.name?.text ?? '<anonymous function declaration>');
    }
    if (
      (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) &&
      bodyOpensWithUseServer(node.body)
    ) {
      hits.push(
        node.parent && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)
          ? node.parent.name.text
          : '<anonymous inline function>'
      );
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return hits;
}

function auditRepository(): Finding[] {
  return collectSourceFiles(join(root, 'src'))
    .map((filePath) => ({ filePath, text: readFileSync(filePath, 'utf8') }))
    .filter(({ text }) => isServerActionModule(text))
    .flatMap(({ filePath, text }) => auditServerActions(filePath, text));
}

describe('every Server Action authorizes first', () => {
  const findings = auditRepository();

  it('audits exactly the Server Actions this repo currently exports', () => {
    // Pinned, not a floor (N13): a `toBeGreaterThanOrEqual` here would stay
    // green even if the auditor silently stopped seeing an entire file, which
    // is exactly the failure mode this suite exists to catch. Counted by hand
    // across the four `'use server'` modules at time of writing:
    // src/modules/google/actions.ts (3) + src/modules/family/actions.ts (13:
    // the six above plus M14's createInvite + revokeInvite + acceptInvite +
    // chooseProfile, the three-interaction second-parent flow, plus M16's
    // updateFamily + setHubDisplay + deleteFamily — the household's own
    // identity and its end) +
    // src/modules/calendar/actions.ts (5: the four event mutations plus M16's
    // setCalendarDisplay, FR28's per-calendar colour and visibility) +
    // src/modules/notifications/actions.ts (1, added in M16:
    // updateNotificationPreferences — `member:self`, so a parent answers only
    // for themselves) + src/modules/routines/actions.ts (6:
    // create/update/delete routine + setRoutineReward + completeStep +
    // undoCompletion, added in M10 so `completion.undone` has a publisher) +
    // src/modules/rewards/actions.ts (8: create/update/delete reward +
    // awardStars + requestRedemption + decideRedemption + fulfillRedemption +
    // seedRewardPresets) + src/modules/timers/actions.ts (2: startTimer +
    // stopTimer) + src/modules/devices/actions.ts (4, added in M12:
    // createPairingCode + pairDevice + revokeDevice, plus cancelPairingCode
    // added in the brute-force/lockout review pass) +
    // src/modules/sharing/actions.ts (2, added in M13: createShareLink +
    // revokeShareLink) = 44, plus M18's three: google's removeCalendar (one
    // calendar out of Kynite, with the event-count confirmation that made the
    // count worth reading), devices' renameDevice (a tablet named wrong at
    // pairing time was previously only fixable by revoking and re-pairing it)
    // and timers' extendTimer (PRD FR7's "a bit longer", server-authoritative
    // in exactly the way start/stop already are) = 47. Self-unpair
    // (`POST /api/devices/session/unpair`) is deliberately *not* here: it is
    // a route handler, not a `'use server'` module, so this auditor never
    // sees it — see that file's doc comment for why it needs no `assertCan`.
    // The same is true of M13's `POST /api/share/completions`, the contributor
    // tick: the `(share)` tree may not import a Server Action and `src/proxy.ts`
    // refuses a POST to it, so that write *cannot* be one. Its authorization
    // lives inside `recordCompletion`, which both it and `completeStepAction`
    // call — see that function's doc comment for why the check was put there
    // rather than at each entry point.
    // Adding or removing a Server Action must bump this number deliberately —
    // that is the point.
    // 47 → 49 in M19 phase 2: `signInWithGoogleAction` and
    // `createFamilyForSocialUserAction`, the two halves of Google sign-in.
    expect(findings.length).toBe(49);
  });

  it('reports no unauthorized action anywhere in src/', () => {
    expect(findings.flatMap((finding) => finding.violation ?? [])).toEqual([]);
  });

  it('pins the exemption list — a new @public-action must be declared here', () => {
    const exempt = findings.filter((finding) => finding.exempt).map((finding) => finding.id);
    expect(exempt.sort()).toEqual([...PUBLIC_ACTIONS].sort());
  });

  it('catches an action that skips authorization (fixture) — function declarations, arrow consts, and function-expression consts alike', () => {
    const filePath = join(root, 'tests/fixtures/unauthorized-action.fixture.ts');
    const findings = auditServerActions(filePath, readFileSync(filePath, 'utf8'));

    // Pinning the count is the point: a checker that silently skips a shape
    // (e.g. only walking `function` declarations) would under-count here
    // instead of failing loudly.
    expect(findings.length).toBe(4);

    expect(findings.map((finding) => finding.violation)).toEqual([
      'tests/fixtures/unauthorized-action.fixture.ts::renameEveryoneAction never calls can()/assertCan()',
      // The tagged one passes the *call* check but is caught by the allowlist:
      null,
      'tests/fixtures/unauthorized-action.fixture.ts::renameEveryoneArrowAction never calls can()/assertCan()',
      'tests/fixtures/unauthorized-action.fixture.ts::renameEveryoneFunctionExpressionAction never calls can()/assertCan()',
    ]);

    const sneaky = findings.filter((finding) => finding.exempt).map((finding) => finding.id);
    expect(PUBLIC_ACTIONS).not.toContain(sneaky[0]);
  });

  it("has no function-body-level 'use server' directive outside a module-level-directive file", () => {
    // `auditServerActions()` only walks the top level of files whose *first*
    // statement is a module-level 'use server' directive. A per-function
    // inline directive elsewhere is structurally invisible to it. Nothing in
    // this repo uses that shape today — this guard exists so the day someone
    // adds one, the suite fails loudly instead of silently never auditing it.
    const offenders = collectSourceFiles(join(root, 'src'))
      .map((filePath) => ({ filePath, text: readFileSync(filePath, 'utf8') }))
      .filter(({ text }) => !isServerActionModule(text))
      .flatMap(({ filePath, text }) => {
        const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.ESNext, true);
        return functionLevelUseServerDirectives(source).map(
          (functionName) => `${relative(root, filePath)}::${functionName}`
        );
      });

    expect(
      offenders,
      "Found a function-body-level 'use server' directive. auditServerActions() cannot see these — " +
        "either hoist the directive to the top of the module (making it a module-level `'use server'` " +
        'file the auditor already walks), or extend auditServerActions()/namedFunctionsIn() to detect ' +
        'and audit this shape before adding one.'
    ).toEqual([]);
  });
});
