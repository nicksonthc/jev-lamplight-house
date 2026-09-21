/** Join class names, dropping anything falsy. */
export const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');
