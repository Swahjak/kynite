import { MAX_CUSTOM_AVATAR_BYTES, checkCustomAvatar, type AvatarRejection } from '../domain/avatar';

/**
 * Turn a picked file into a validated `data:` URI, in the browser.
 *
 * This is a courtesy layer, not a security one: the same `checkCustomAvatar()`
 * runs again inside the Server Action's schema, which is the check that
 * decides. Running it here as well means a parent who picks the wrong file
 * learns so instantly instead of after a round trip — and, because it is
 * literally the same function, the two answers cannot drift apart.
 */

export type AvatarUploadError = 'tooLarge' | 'invalidFile';

export type AvatarUploadResult =
  { ok: true; dataUri: string } | { ok: false; error: AvatarUploadError };

/** Only the size rejection gets its own message; the rest are all "that file will not work". */
function messageFor(reason: AvatarRejection): AvatarUploadError {
  return reason === 'tooLarge' ? 'tooLarge' : 'invalidFile';
}

export async function readAvatarFile(file: File): Promise<AvatarUploadResult> {
  // Cheap pre-check on the file itself, so a 4 MB photo is refused without
  // being base64-encoded into a string first.
  if (file.size > MAX_CUSTOM_AVATAR_BYTES) return { ok: false, error: 'tooLarge' };

  let dataUri: string;
  try {
    dataUri = await readAsDataUri(file);
  } catch {
    return { ok: false, error: 'invalidFile' };
  }

  const checked = checkCustomAvatar(dataUri);
  if (!checked.ok) return { ok: false, error: messageFor(checked.reason) };

  return { ok: true, dataUri };
}

function readAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('not a string'));
    reader.readAsDataURL(file);
  });
}
