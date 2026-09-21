import { useJevStore } from '../useJevStore';
import { cx } from './cx';
import { jevCopy } from '../copy';
import { describeHouse, nudgeTarget, WELCOME_LEVELS, type Mood, type Nudge } from '../questions';
import { Distribution } from './Distribution';

/**
 * Jev's four answers, shown as the types they are.
 *
 * A choice gets its distribution, not just its winner; a score gets the
 * ladder it was scored against; a boolean gets its probability rather than a
 * yes. That is the point of putting an evaluation model behind a scene — the
 * house can act on 0.62 — and flattening it to prose in the panel while the
 * scene used the number would be the page lying about its own workings.
 *
 * The source badge is load-bearing too. When the gateway refuses, the local
 * rules answer and say so, because a page that quietly swapped judges would
 * hide exactly the failure worth seeing.
 */

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-rice/12 px-3 py-3 first:border-t-0">
      <p className="plaque">{label}</p>
      {children}
    </div>
  );
}

export function Reading() {
  const language = useJevStore((s) => s.language);
  const t = jevCopy[language];
  const reply = useJevStore((s) => s.reply);
  const asking = useJevStore((s) => s.asking);
  const auto = useJevStore((s) => s.auto);
  const toggleAuto = useJevStore((s) => s.toggleAuto);
  const ask = useJevStore((s) => s.ask);
  const switches = useJevStore((s) => s.switches);
  const flip = useJevStore((s) => s.flip);

  const verdict = reply?.verdict ?? null;
  const levels = WELCOME_LEVELS.length - 1;

  const applyNudge = (nudge: Nudge) => {
    const target = nudgeTarget(nudge, switches);
    if (target && switches[target.part] !== target.want) flip(target.part);
  };

  return (
    <section className="panel pointer-events-auto flex flex-col rounded-lg">
      <header className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <h2 className="plaque">{t.verdict}</h2>
        {reply && (
          <span
            title={
              reply.note ?? `${t.sourceNote}${reply.auth ? ` · ${reply.auth}` : ''}`
            }
            className={cx(
              'rounded-full border px-2 py-0.5 text-[0.55rem] tracking-[0.14em] uppercase',
              reply.source === 'jev'
                ? 'border-lantern/60 text-lantern'
                : 'border-reed/60 text-reed',
            )}
          >
            {reply.source === 'jev' ? t.sources.jev : t.localBadge}
          </span>
        )}
      </header>

      {!verdict && (
        <p className="px-3 pb-3 text-[0.78rem] text-reed">{asking ? t.asking : t.waiting}</p>
      )}

      {verdict && (
        <>
          <Field label={t.questions.mood}>
            <p className="font-display text-2xl text-rice lowercase">
              {t.moods[verdict.mood.choice as Mood]}
            </p>
            <Distribution
              probabilities={verdict.mood.probabilities}
              chosen={verdict.mood.choice}
              label={(key) => t.moods[key as Mood] ?? key}
            />
          </Field>

          <Field label={t.questions.welcome}>
            <div className="flex items-center gap-2">
              <span className="flex flex-1 gap-1">
                {WELCOME_LEVELS.map((_, i) => (
                  <span
                    key={i}
                    className={cx(
                      'h-1.5 flex-1 rounded-full',
                      verdict.welcome.score >= i - 0.35 ? 'bg-lantern' : 'bg-ink/50',
                    )}
                  />
                ))}
              </span>
              <span className="text-[0.62rem] text-reed tabular-nums">
                {verdict.welcome.score.toFixed(1)} / {levels}
              </span>
            </div>
            <p className="mt-1.5 text-[0.8rem] text-rice-dim">
              {t.welcomeLevels[Math.round(verdict.welcome.score)]}
            </p>
          </Field>

          <Field label={t.questions.cat}>
            <div className="flex items-center gap-2">
              <span className="h-1.5 flex-1 rounded-full bg-ink/50">
                <span
                  className="block h-1.5 rounded-full bg-lantern transition-[width] duration-700"
                  style={{ width: pct(verdict.cat.probability) }}
                />
              </span>
              <span className="text-[0.62rem] text-lantern tabular-nums">
                {pct(verdict.cat.probability)}
              </span>
            </div>
            {/* These two thresholds are where the cat actually is, not round
                numbers: `Cat.tsx` eases P(true) through smoothstep(.12, .92)
                and reads it along a four-point curve, so it clears the
                doorstep around .42 and is down on the rug around .78. The
                caption has to agree with the scene. */}
            <p className="mt-1.5 text-[0.8rem] text-rice-dim">
              {verdict.cat.probability > 0.78
                ? t.catIn
                : verdict.cat.probability > 0.42
                  ? t.catStep
                  : t.catOut}
            </p>
          </Field>

          <Field label={t.questions.nudge}>
            <button
              type="button"
              disabled={nudgeTarget(verdict.nudge.choice, switches) === null}
              onClick={() => applyNudge(verdict.nudge.choice)}
              className={cx(
                'w-full rounded border px-3 py-2 text-left text-[0.82rem] transition-colors duration-200',
                nudgeTarget(verdict.nudge.choice, switches) === null
                  ? 'cursor-default border-rice/15 text-reed'
                  : 'cursor-pointer border-jade/70 bg-jade/20 text-rice hover:bg-jade/35',
              )}
            >
              {t.nudges[verdict.nudge.choice]}
            </button>
          </Field>
        </>
      )}

      {reply?.note && (
        <p className="border-t border-rice/12 px-3 py-2 text-[0.66rem] leading-relaxed text-reed">
          {reply.note}
        </p>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-rice/12 px-3 py-2.5">
        <label className="flex cursor-pointer items-center gap-2 text-[0.66rem] text-reed">
          <input
            type="checkbox"
            checked={auto}
            onChange={toggleAuto}
            className="size-3 accent-lantern"
          />
          {t.auto}
        </label>
        <span className="flex items-center gap-2">
          {reply?.ms !== undefined && (
            <span className="text-[0.6rem] text-reed tabular-nums">
              {reply.ms} ms{reply.inputTokens ? ` · ${reply.inputTokens} ${t.tokens}` : ''}
              {reply.source === 'jev' && reply.auth ? ` · ${reply.auth}` : ''}
            </span>
          )}
          <button
            type="button"
            onClick={() => void ask()}
            disabled={asking}
            className={cx(
              'cursor-pointer rounded border border-lantern/60 px-3 py-1.5 text-[0.66rem] tracking-[0.12em] text-lantern uppercase transition-colors duration-200',
              asking ? 'opacity-50' : 'hover:bg-lantern/20',
            )}
          >
            {asking ? t.asking : t.ask}
          </button>
        </span>
      </footer>

      <details className="border-t border-rice/12 px-3 py-2">
        <summary className="plaque cursor-pointer list-none">{t.state}</summary>
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-ink/45 p-2 text-[0.6rem] leading-relaxed whitespace-pre-wrap text-reed">
          {JSON.stringify(describeHouse(switches), null, 1)}
        </pre>
      </details>
    </section>
  );
}
