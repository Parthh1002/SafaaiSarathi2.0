import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MessageCircle, Phone, Check, Loader2 } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Card, SectionTitle, toast, useTheme } from '../../components/ui';
import { LOCALE_LIST, LOCALES, useI18n, type Locale } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';

export default function Profile() {
  const { user, refresh } = useAuth();
  const { dark, toggle } = useTheme();
  const { locale, setLocale, t } = useI18n();

  /**
   * The picker drives the UI language immediately and persists it to the
   * profile, so notifications and the IVR line use the same choice.
   */
  const [language, setLanguage] = useState<Locale>((user?.language as Locale) ?? locale);

  const save = useMutation({
    mutationFn: async (next: string) => (await api('citizen').patch('/citizen/profile', { language: next })).data,
    onSuccess: async () => {
      await refresh();
      toast.success(t('citizen.profile.saved'));
    },
    onError: (err) => toast.error(errorMessage(err, t('citizen.profile.saveFailed'))),
  });

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h1 className="text-fluid-xl font-bold tracking-tight">{t('citizen.profile.title')}</h1>

      <Card className="flex items-center gap-3 p-4">
        <span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-fluid-lg font-bold text-white"
          style={{ background: user?.avatarColor || '#15803d' }}
        >
          {user?.name?.[0]}
        </span>
        <div className="min-w-0">
          <p className="truncate text-fluid-base font-semibold">{user?.name}</p>
          <p className="truncate text-fluid-xs text-muted">{user?.email || user?.phone}</p>
          {user?.ward && <p className="truncate text-fluid-xs text-muted">{user.ward.name}</p>}
        </div>
      </Card>

      <section>
        <SectionTitle title={t('common.language')} subtitle={t('citizen.profile.langHint')} />
        <div className="grid grid-cols-3 gap-2">
          {LOCALE_LIST.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                setLanguage(code);
                setLocale(code);
                save.mutate(code);
              }}
              className={`min-h-touch rounded-xl border text-fluid-sm font-semibold transition ${
                language === code ? 'border-brand bg-brand/10 text-brand' : 'border-line bg-elevated text-muted'
              }`}
            >
              {save.isPending && language === code ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : LOCALES[code].native}
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle title={t('common.theme')} />
        <Card className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-fluid-sm font-medium">{t('common.darkTheme')}</p>
            <p className="text-fluid-xs text-muted">{t('citizen.profile.darkHint')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={dark}
            onClick={toggle}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${dark ? 'bg-brand' : 'bg-line'}`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${dark ? 'left-6' : 'left-1'}`}
            />
          </button>
        </Card>
      </section>

      <section>
        <SectionTitle title={t('citizen.profile.otherWays')} subtitle={t('citizen.profile.otherWaysSub')} />
        <div className="space-y-2">
          <Card className="flex items-start gap-3 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-fluid-sm font-semibold">{t('landing.channels.whatsapp')}</p>
              <p className="mt-0.5 text-fluid-xs text-muted">
                {t('citizen.profile.whatsappBody')}
              </p>
            </div>
          </Card>
          <Card className="flex items-start gap-3 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <Phone className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-fluid-sm font-semibold">{t('landing.channels.ivr')}</p>
              <p className="mt-0.5 text-fluid-xs text-muted">
                {t('citizen.profile.ivrBody')}
              </p>
            </div>
          </Card>
        </div>
      </section>

      <p className="flex items-center justify-center gap-1.5 text-fluid-xs text-faint">
        <Check className="h-3.5 w-3.5" /> Safaai Sarathi v1.0
      </p>
    </div>
  );
}
