import { useJevStore, type SwitchId } from '../useJevStore';
import { cx } from './cx';
import { jevCopy } from '../copy';
import { nudgeTarget, PART_IDS, type PartId } from '../questions';

/**
 * The eleven switches and the weather, as a panel.
 *
 * It is the same interface as clicking the house — both call `flip` — so the
 * panel is a list of what there is to touch rather than a second way of
 * doing something. Hovering a row lights the part in the scene through the
 * same `hovered` the raycast writes, which is why the two never disagree.
 */

function Row({ id, name, on, off }: { id: SwitchId; name: string; on: string; off: string }) {
  const value = useJevStore((s) => s.switches[id]);
  const hovered = useJevStore((s) => s.hovered);
  const flip = useJevStore((s) => s.flip);
  const setHovered = useJevStore((s) => s.setHovered);
  const nudge = useJevStore((s) => s.reply?.verdict.nudge.choice ?? null);
  const switches = useJevStore((s) => s.switches);
  const isPart = id !== 'raining';
  const lit = isPart && hovered === id;
  // The ring in the scene marks where the part *is*, which for the hearth is
  // behind a wall. Lighting its row too says which switch Jev meant.
  const wanted = isPart && nudge !== null && nudgeTarget(nudge, switches)?.part === id;

  return (
    <button
      type="button"
      onClick={() => flip(id)}
      onPointerEnter={() => isPart && setHovered(id as PartId)}
      onPointerLeave={() => isPart && setHovered(null)}
      aria-pressed={value}
      className={cx(
        'pointer-events-auto flex w-full cursor-pointer items-center justify-between gap-3 rounded px-2.5 py-2 text-left transition-colors duration-150',
        lit ? 'bg-rice/15' : 'hover:bg-rice/10',
        wanted && 'ring-1 ring-jade/70 ring-inset',
      )}
    >
      <span className="text-[0.8rem] text-rice-dim">{name}</span>
      <span className="flex items-center gap-2">
        <span
          className={cx(
            'text-[0.62rem] tracking-[0.12em] uppercase',
            value ? 'text-lantern' : 'text-reed',
          )}
        >
          {value ? on : off}
        </span>
        <span
          aria-hidden
          className={cx(
            'relative h-4 w-8 rounded-full border transition-colors duration-200',
            value ? 'border-lantern/70 bg-lantern/35' : 'border-rice/25 bg-ink/40',
          )}
        >
          <span
            className={cx(
              'absolute top-[2px] h-[10px] w-[10px] rounded-full transition-all duration-200',
              value ? 'left-[18px] bg-lantern' : 'left-[3px] bg-reed',
            )}
          />
        </span>
      </span>
    </button>
  );
}

export function Switchboard() {
  const language = useJevStore((s) => s.language);
  const t = jevCopy[language];

  return (
    <section className="panel pointer-events-auto rounded-lg p-3">
      <h2 className="plaque px-2.5 pb-1.5">{t.switchboard}</h2>
      <div className="flex flex-col">
        {PART_IDS.map((id) => (
          <Row key={id} id={id} {...t.parts[id]} />
        ))}
      </div>
      <h2 className="plaque mt-2 border-t border-rice/15 px-2.5 pt-2.5 pb-1.5">{t.outside}</h2>
      <Row id="raining" {...t.raining} />
    </section>
  );
}
