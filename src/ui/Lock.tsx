import { useEffect, useRef, useState } from 'react';
import { jevCopy } from '../copy';
import { useJevStore } from '../useJevStore';
import { cx } from './cx';

/**
 * The lock screen.
 *
 * It is the *consequence* of the gate, not the gate itself — the password is
 * checked in `src/server/session.ts` and enforced on `/api/jev`, so removing
 * this component in the devtools buys nothing but a view of an unlit
 * cottage. That is the right shape: the thing worth protecting is the model
 * call, and it is protected where it is made.
 */
export function Lock() {
  const language = useJevStore((s) => s.language);
  const t = jevCopy[language];
  const gate = useJevStore((s) => s.gate);
  const unlock = useJevStore((s) => s.unlock);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  const locked = gate?.required === true && !gate.unlocked;

  useEffect(() => {
    if (locked) field.current?.focus();
  }, [locked]);

  if (!locked) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError(await unlock(password));
    setBusy(false);
    setPassword('');
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/85 p-6 backdrop-blur-md">
      <form onSubmit={submit} className="panel w-full max-w-md rounded-xl p-7 sm:p-9">
        <p className="plaque text-lantern">{t.mark}</p>
        <h1 className="font-display mt-2 text-3xl leading-tight text-rice">{t.locked}</h1>
        <p className="mt-4 text-[0.82rem] leading-relaxed text-rice-dim">
          {gate?.misconfigured ? t.misconfigured : t.lockedBlurb}
        </p>

        {!gate?.misconfigured && (
          <>
            <label className="plaque mt-6 block" htmlFor="jev-password">
              {t.password}
            </label>
            <input
              ref={field}
              id="jev-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
              className="mt-1.5 w-full rounded border border-rice/25 bg-ink/45 px-3 py-2.5 text-[0.9rem] text-rice outline-none focus:border-lantern/70"
            />
            <button
              type="submit"
              disabled={busy || !password}
              className={cx(
                'mt-4 w-full cursor-pointer rounded border border-lantern/60 px-4 py-3 text-[0.7rem] tracking-[0.2em] text-lantern uppercase transition-colors duration-200',
                busy || !password ? 'opacity-50' : 'hover:bg-lantern/20',
              )}
            >
              {busy ? t.unlocking : t.unlock}
            </button>
          </>
        )}

        <p aria-live="polite" className="mt-3 min-h-4 text-[0.7rem] text-reed">
          {error ?? t.lockedNote}
        </p>
      </form>
    </div>
  );
}
