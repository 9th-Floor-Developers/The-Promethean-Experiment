import { useEffect, useRef, useState } from 'react';
import { A, type SimInfo, type SimSnapshot } from './types';

/** A world event announced as fading text at the top of the page (docs/visuals/OVERHEAD_EFFECTS.MD, TITLE EFFECTS). */
export interface TitleEvent {
    id: number;
    text: string;
    /** Major events (extinction, population milestones) use bigger text than minor ones (a new day). */
    kind: 'major' | 'minor';
}

/** How long (ms) an event stays in the list; the CSS fade matches it. */
export const TITLE_EVENT_MS = 3600;
/** Most events shown at once; older ones are dropped first. */
const MAX_EVENTS = 4;

interface Tracking {
    info: SimInfo | null;
    counts: number[];
    day: number;
    /** Exponent X of the last 10^X milestone each species announced, or 0 for none. */
    lastMilestone: number[];
}

/**
 * Watches the simulation snapshots and announces world events: a species going extinct and a species reaching a
 * population of 10, 100, 1000... (major), and a new day (minor). A milestone is not repeated while it is the
 * last one the species announced, so a population bobbing around 10 does not spam.
 */
export function useTitleEffects(snapshot: SimSnapshot | null, info: SimInfo | null): TitleEvent[] {
    const [events, setEvents] = useState<TitleEvent[]>([]);
    const tracking = useRef<Tracking>({ info: null, counts: [], day: 0, lastMilestone: [] });
    const nextId = useRef(1);

    useEffect(() => {
        if (!snapshot || !info) return;
        const t = tracking.current;
        const counts = new Array<number>(info.species.length).fill(0);
        for (const row of snapshot.animals) counts[row[A.species]!]!++;

        // A new simulation: start tracking from its first snapshot without announcing anything.
        if (t.info !== info) {
            tracking.current = { info, counts, day: snapshot.day, lastMilestone: counts.map(() => 0) };
            setEvents([]);
            return;
        }

        const fresh: Omit<TitleEvent, 'id'>[] = [];
        if (snapshot.day > t.day) fresh.push({ text: `Day ${snapshot.day}`, kind: 'minor' });
        counts.forEach((count, i) => {
            const before = t.counts[i]!;
            const name = info.species[i]!.name;
            if (before > 0 && count === 0) fresh.push({ text: `${name} went extinct`, kind: 'major' });
            for (let x = 1; 10 ** x <= count; x++) {
                if (before < 10 ** x && t.lastMilestone[i] !== x) {
                    fresh.push({ text: `${name} reached ${(10 ** x).toLocaleString()} animals`, kind: 'major' });
                    t.lastMilestone[i] = x;
                }
            }
        });
        t.counts = counts;
        t.day = snapshot.day;
        if (fresh.length === 0) return;

        const added = fresh.map((e) => ({ ...e, id: nextId.current++ }));
        setEvents((prev) => [...prev, ...added].slice(-MAX_EVENTS));
        for (const e of added) setTimeout(() => setEvents((prev) => prev.filter((p) => p.id !== e.id)), TITLE_EVENT_MS);
    }, [snapshot, info]);

    return events;
}
