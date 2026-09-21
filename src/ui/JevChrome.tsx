import { useJevStore, type ViewName } from '../useJevStore';
import { cx } from './cx';
import { jevCopy } from '../copy';

const VIEW_ORDER: ViewName[] = ['garden', 'porch', 'parlour'];

/** The mark, where to stand, and the way back to the other three pages. */
export function JevChrome() {
  const language = useJevStore((s) => s.language);
  const toggleLanguage = useJevStore((s) => s.toggleLanguage);
  const t = jevCopy[language];
  const view = useJevStore((s) => s.view);
  const setView = useJevStore((s) => s.setView);

  return (
    <>
      <header className="pointer-events-none fixed top-0 left-0 z-10 max-w-[min(30rem,calc(100vw-2rem))] p-5 sm:p-7">
        <p className="plaque text-lantern">{t.mark}</p>
        <h1 className="font-display mt-1 text-3xl leading-tight text-rice sm:text-4xl">
          {t.title}
        </h1>
        <p className="mt-1.5 text-[0.78rem] text-rice-dim">{t.subtitle}</p>

        <nav aria-label={t.viewsAria} className="mt-4 flex flex-wrap gap-2">
          {VIEW_ORDER.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setView(name)}
              aria-current={view === name}
              className={cx(
                'panel pointer-events-auto cursor-pointer rounded-full px-3.5 py-1.5 text-[0.62rem] tracking-[0.16em] uppercase transition-colors duration-200',
                view === name ? 'text-lantern' : 'text-mist hover:text-rice',
              )}
            >
              {t.views[name]}
            </button>
          ))}
        </nav>
      </header>

      <footer className="pointer-events-none fixed bottom-0 left-0 z-10 flex max-w-[min(30rem,calc(100vw-2rem))] flex-wrap items-center gap-x-4 gap-y-2 p-5 sm:p-7">
        <p className="plaque">{t.hint}</p>
        <a
          href="https://github.com/nicksonthc/jev-lamplight-house"
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto text-[0.62rem] tracking-[0.16em] text-mist uppercase transition-colors duration-200 hover:text-lantern"
        >
          {t.source}
        </a>
        <a
          href="https://vercel.com/docs/ai-gateway"
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto text-[0.62rem] tracking-[0.16em] text-mist uppercase transition-colors duration-200 hover:text-lantern"
        >
          {t.gateway}
        </a>
        <button
          type="button"
          onClick={toggleLanguage}
          aria-label={t.switchLanguage}
          className="pointer-events-auto cursor-pointer text-[0.62rem] tracking-[0.16em] text-mist uppercase transition-colors duration-200 hover:text-lantern"
        >
          {t.toggle}
        </button>
      </footer>
    </>
  );
}
