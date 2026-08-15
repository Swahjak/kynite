'use client';

import Image from 'next/image';
import { useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, cn, FieldGroupLabel, Icon } from '@kynite/ui';
import { CUSTOM_AVATAR_ACCEPT, isCustomAvatarUrl } from '../domain/avatar';
import { readAvatarFile, type AvatarUploadError } from './avatar-upload';
import { MEMBER_AVATARS, avatarUrlFor, avatarNameFrom, type MemberAvatar } from './tokens';

/**
 * Built-in avatar picker, plus the "bring your own" tile (M20).
 *
 * One hidden input carries the answer either way, because `member.avatarUrl` is
 * one column: a preset selection writes `/avatars/fox.svg`, an upload writes a
 * `data:` URI. That is what keeps switching between the two free — there is no
 * mode to leave, only a different value in the same field.
 *
 * Kiosk-sized targets throughout; empty selection falls back to initials.
 */
export function AvatarPicker({
  name = 'avatarUrl',
  defaultValue = null,
}: {
  name?: string;
  /** The member's stored `avatarUrl` — a preset path, a data URI, or nothing. */
  defaultValue?: string | null;
}) {
  const t = useTranslations('family.form');
  const labelId = useId();
  const fileInput = useRef<HTMLInputElement>(null);

  const [preset, setPreset] = useState<MemberAvatar | null>(() => avatarNameFrom(defaultValue));
  const [custom, setCustom] = useState<string | null>(() =>
    defaultValue && isCustomAvatarUrl(defaultValue) ? defaultValue : null
  );
  const [error, setError] = useState<AvatarUploadError | null>(null);

  const value = custom ?? (preset ? avatarUrlFor(preset) : '');

  async function onFilePicked(file: File | undefined) {
    if (!file) return;
    setError(null);

    const result = await readAvatarFile(file);
    if (!result.ok) {
      setError(result.error);
      // Clearing lets the *same* file be picked again after the parent shrinks
      // it — without this, `change` never fires a second time.
      if (fileInput.current) fileInput.current.value = '';
      return;
    }

    setCustom(result.dataUri);
    setPreset(null);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <FieldGroupLabel id={labelId}>{t('avatar')}</FieldGroupLabel>
      <input type="hidden" name={name} value={value} />
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {MEMBER_AVATARS.map((avatar) => (
          <Button
            key={avatar}
            type="button"
            variant="outline"
            size="icon-hub"
            aria-pressed={preset === avatar}
            aria-label={t(`avatars.${avatar}`)}
            onClick={() => {
              // Picking a preset always wins over an upload, including one made
              // a moment ago: the field holds one value.
              setPreset(preset === avatar ? null : avatar);
              setCustom(null);
              setError(null);
            }}
            className={cn('p-1', preset === avatar && 'border-ring ring-3 ring-ring/50')}
          >
            <Image src={avatarUrlFor(avatar)} alt="" width={32} height={32} aria-hidden />
          </Button>
        ))}

        <Button
          type="button"
          variant="outline"
          size="icon-hub"
          aria-pressed={custom !== null}
          aria-label={t('avatarUpload')}
          data-testid="avatar-upload-open"
          onClick={() => fileInput.current?.click()}
          className={cn('p-1', custom !== null && 'border-ring ring-3 ring-ring/50')}
        >
          {custom ? (
            // A plain `<img>`, never inline SVG: an SVG behind `src` is an
            // isolated, script-disabled document, which is the property the
            // whole upload path is validated against (`domain/avatar.ts`).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={custom}
              alt=""
              aria-hidden
              data-testid="avatar-upload-preview"
              className="size-8 rounded-lg object-cover"
            />
          ) : (
            <Icon name="add" size="md" />
          )}
        </Button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={CUSTOM_AVATAR_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="avatar-upload-input"
        onChange={(event) => void onFilePicked(event.target.files?.[0])}
      />

      {error ? (
        <p role="alert" className="text-xs text-destructive" data-testid="avatar-upload-error">
          {t(`avatarErrors.${error}`)}
        </p>
      ) : (
        // A plain paragraph, not `FieldDescription`: this picker is a `role=group`
        // rather than a `Field.Root` (same reason it uses `FieldGroupLabel`), and
        // Base UI's description reads a context that does not exist here.
        <p className="text-xs text-muted-foreground">{t('avatarUploadHint')}</p>
      )}
    </div>
  );
}
