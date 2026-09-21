import { cx } from './cx';

/**
 * One typed answer's probability distribution, as bars.
 *
 * Shared by the reading and the response panel because it is the one thing
 * about an evaluation model worth showing twice: the winning option is only
 * half the answer, and a 0.60/0.36 split between *sleepy* and *festive* says
 * something a bare word does not.
 */
export function Distribution({
  probabilities,
  label,
  chosen,
  limit = 3,
  wide = false,
}: {
  probabilities: Record<string, number> | undefined;
  label: (key: string) => string;
  chosen: string;
  /** How many options to show, best first. `Infinity` for all of them. */
  limit?: number;
  /** Wider label column, for panels whose option names are sentences. */
  wide?: boolean;
}) {
  if (!probabilities) return null;
  const rows = Object.entries(probabilities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  return (
    <ul className="mt-2 flex flex-col gap-1">
      {rows.map(([key, p]) => (
        <li key={key} className="flex items-center gap-2">
          <span
            className={cx(
              'shrink-0 truncate text-[0.62rem] tracking-[0.08em] uppercase',
              wide ? 'w-36' : 'w-24',
              key === chosen ? 'text-lantern' : 'text-reed',
            )}
          >
            {label(key)}
          </span>
          <span className="h-1 flex-1 rounded-full bg-ink/50">
            <span
              className={cx('block h-1 rounded-full', key === chosen ? 'bg-lantern' : 'bg-reed/60')}
              style={{ width: `${Math.round(p * 100)}%` }}
            />
          </span>
          <span className="w-9 shrink-0 text-right text-[0.6rem] text-reed tabular-nums">
            {Math.round(p * 100)}%
          </span>
        </li>
      ))}
    </ul>
  );
}
