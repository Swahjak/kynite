import { useTranslations } from 'next-intl';

export default function MarketingHomePage() {
  const t = useTranslations('common');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-3xl font-semibold">{t('appName')}</h1>
      <p className="text-sm opacity-70">Greenfield scaffold — M01.</p>
    </main>
  );
}
