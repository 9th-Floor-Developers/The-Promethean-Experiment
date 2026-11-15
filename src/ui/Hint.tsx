import type { ReactNode } from 'react';

/**
 * A label with an explanation attached: hovering it shows `text` as a tooltip.
 *
 * Drawn with a dotted underline and a help cursor so it is clear there is something to hover.
 * Uses the browser's own tooltip, which cannot be clipped by the scrolling panels it is used in.
 */
export function Hint({ text, children, className }: { text: string; children: ReactNode; className?: string }) {
    return <span className={className ? `hint ${className}` : 'hint'} title={text}>{children}</span>;
}
