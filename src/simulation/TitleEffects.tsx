import { useTitleEffects } from '../sim/useTitleEffects';
import type { SimInfo, SimSnapshot } from '../sim/types';

interface Props {
    snapshot: SimSnapshot | null;
    info: SimInfo | null;
}

/** World-event announcements shown over the top of the page that fade out by themselves (see useTitleEffects). */
export function TitleEffects({ snapshot, info }: Props) {
    const events = useTitleEffects(snapshot, info);
    return (
        <div className="title-effects" aria-live="polite">
            {events.map((e) => (
                <div key={e.id} className={`title-effects__item title-effects__item--${e.kind}`}>{e.text}</div>
            ))}
        </div>
    );
}
