import { useState } from 'react';
import { useJevStore } from '../useJevStore';
import { cx } from './cx';
import { jevCopy } from '../copy';
import { WELCOME_LEVELS, type Mood, type Nudge } from '../questions';
import { Distribution } from './Distribution';

/**
 * The machine view of the same answer the reading panel puts in words: the
 * envelope the gateway returned, every option's probability rather than the
 * three that fit beside the verdict, the raw JSON, and the last dozen asks.
 *
 * It earns its space because the interesting thing about an evaluation model
 * is not the word it picked but how surely, and how that moves as the house
 * changes — which is only visible with the previous answers still on screen.
 * Distributions are also the one part that the local rule judge cannot fake:
 * when the fallback is answering, these rows are simply empty.
 */

// 24 hour explicitly: an AM/PM locale wraps the column onto two lines.
const time = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-rice/12 px-3 py-2 first:border-t-0">
      <p className="plaque">{label}</p>
      {children}
    </div>
  );
}

export function Response() {
  const language = useJevStore((s) => s.language);
  const t = jevCopy[language];
  const reply = useJevStore((s) => s.reply);
  const history = useJevStore((s) => s.history);
  const [open, setOpen] = useState(true);

  const verdict = reply?.verdict;
  // The score's distribution is keyed by the ladder's own indices.
  const rung = (key: string) => t.welcomeLevels[Number(key)] ?? key;

  return (
    <section className="panel pointer-events-auto hidden w-[min(23rem,32vw)] flex-col rounded-lg lg:flex">
      <header className="flex items-center justify-between gap-2 px-3 py-2.5">
        <h2 className="plaque">{t.response}</h2>
        <span className="flex items-center gap-2">
          {reply && (
            <span className="text-[0.6rem] text-reed tabular-nums">
              {reply.cached ? `${t.cached} · ` : ''}
              {reply.auth ? `${t.auths[reply.auth]} · ` : ''}
              {reply.ms !== undefined ? `${reply.ms} ms` : '—'}
              {reply.inputTokens ? ` · ${reply.inputTokens} ${t.tokens}` : ''}
            </span>
          )}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? t.responseHide : t.responseShow}
            className="cursor-pointer px-1 text-[0.7rem] leading-none text-reed transition-colors duration-200 hover:text-lantern"
          >
            {open ? '−' : '+'}
          </button>
        </span>
      </header>

      {open && (
        <>
          {!verdict && <p className="px-3 pb-3 text-[0.72rem] text-reed">{t.noAsks}</p>}

          {verdict && (
            <>
              <Row label={t.questions.mood}>
                <p className="text-[0.82rem] text-rice lowercase">
                  {t.moods[verdict.mood.choice as Mood]}
                </p>
                <Distribution
                  probabilities={verdict.mood.probabilities}
                  chosen={verdict.mood.choice}
                  label={(key) => t.moods[key as Mood] ?? key}
                  limit={Infinity}
                  wide
                />
              </Row>

              <Row label={t.questions.welcome}>
                <p className="text-[0.82rem] text-rice tabular-nums">
                  {verdict.welcome.score.toFixed(2)} / {WELCOME_LEVELS.length - 1}
                </p>
                <Distribution
                  probabilities={verdict.welcome.probabilities}
                  chosen={String(Math.round(verdict.welcome.score))}
                  label={rung}
                  limit={Infinity}
                  wide
                />
              </Row>

              <Row label={t.questions.cat}>
                <p className="text-[0.82rem] text-rice tabular-nums">
                  {t.probability} {verdict.cat.probability.toFixed(2)}
                </p>
              </Row>

              <Row label={t.questions.nudge}>
                <p className="text-[0.82rem] text-rice">{t.nudges[verdict.nudge.choice]}</p>
                <Distribution
                  probabilities={verdict.nudge.probabilities}
                  chosen={verdict.nudge.choice}
                  label={(key) => t.nudges[key as Nudge] ?? key}
                  limit={4}
                  wide
                />
              </Row>

              <details className="border-t border-rice/12 px-3 py-2">
                <summary className="plaque cursor-pointer list-none">{t.raw}</summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded bg-ink/45 p-2 text-[0.58rem] leading-relaxed whitespace-pre-wrap text-reed">
                  {JSON.stringify(reply, null, 1)}
                </pre>
              </details>
            </>
          )}

          {history.length > 1 && (
            <div className="border-t border-rice/12 px-3 py-2">
              <p className="plaque pb-1">{t.recent}</p>
              <ul className="flex flex-col">
                {history.map((record) => (
                  <li
                    key={record.at}
                    className="flex items-center gap-2 py-0.5 text-[0.6rem] tabular-nums"
                  >
                    <span className="w-8 shrink-0 text-reed">{time(record.at)}</span>
                    <span
                      className={cx(
                        'w-14 shrink-0 truncate',
                        record.reply.source === 'jev' ? 'text-lantern' : 'text-reed',
                      )}
                    >
                      {t.moods[record.reply.verdict.mood.choice as Mood]}
                    </span>
                    <span className="w-7 shrink-0 text-reed">
                      {record.reply.verdict.welcome.score.toFixed(1)}
                    </span>
                    <span className="w-8 shrink-0 text-reed">
                      {record.reply.verdict.cat.probability.toFixed(2)}
                    </span>
                    <span className="flex-1 truncate text-mist">
                      {t.nudges[record.reply.verdict.nudge.choice]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
