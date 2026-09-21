import { useState } from 'react';
import { useJevStore } from '../useJevStore';
import { cx } from './cx';
import { jevCopy } from '../copy';

/**
 * What the page is, said once before it is in the way.
 *
 * It is worth a card rather than a tooltip: a visitor who does not know that
 * Jev is an *evaluation* model will read the panel as a chatbot's opinion,
 * and the difference — typed questions, a distribution, a number the scene
 * can act on — is the whole reason the page exists.
 */
export function TitleCard() {
  const language = useJevStore((s) => s.language);
  const t = jevCopy[language];
  const ready = useJevStore((s) => s.ready);
  const gate = useJevStore((s) => s.gate);
  const locked = gate === null || (gate.required && !gate.unlocked);
  const ask = useJevStore((s) => s.ask);
  const [dismissed, setDismissed] = useState(false);

  const enter = () => {
    setDismissed(true);
    void ask();
  };

  return (
    <div
      aria-hidden={dismissed || locked}
      className={cx(
        'fixed inset-0 z-20 flex items-center justify-center bg-ink/75 p-6 backdrop-blur-sm transition-opacity duration-700',
        dismissed || locked ? 'pointer-events-none opacity-0' : 'opacity-100',
      )}
    >
      <div className="panel max-w-xl rounded-xl p-7 sm:p-9">
        <p className="plaque text-lantern">{t.mark}</p>
        <h1 className="font-display mt-2 text-4xl leading-tight text-rice">{t.title}</h1>
        <p className="mt-1 text-[0.82rem] text-mist">{t.subtitle}</p>
        <p className="mt-5 text-[0.9rem] leading-relaxed text-rice-dim">{t.blurb}</p>
        <button
          type="button"
          onClick={enter}
          disabled={!ready}
          className={cx(
            'mt-7 w-full cursor-pointer rounded border border-lantern/60 px-4 py-3 text-[0.7rem] tracking-[0.2em] text-lantern uppercase transition-colors duration-200',
            ready ? 'hover:bg-lantern/20' : 'animate-breathe opacity-60',
          )}
        >
          {ready ? t.begin : t.loading}
        </button>
      </div>
    </div>
  );
}
