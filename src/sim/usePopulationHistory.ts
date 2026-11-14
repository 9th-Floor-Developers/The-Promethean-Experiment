import { useEffect, useRef, useState } from 'react';
import { A, type SimInfo, type SimSnapshot } from './types';

/** One population sample: the tick it was taken at and the living animal count per species (indexed like SimInfo.species). */
export interface PopulationSample {
    tick: number;
    counts: number[];
}

/** Record a sample every this many ticks (30 ticks = 1 real second, so about 3 samples per second). */
const SAMPLE_EVERY_TICKS = 10;
/** When the history grows past this, every second sample is dropped and the sampling interval doubles. */
const MAX_SAMPLES = 600;

/**
 * Accumulates population-over-time samples from the live snapshot stream.
 * Lives above the simulation screen so the history survives leaving and re-entering it.
 * Restarts if the tick counter goes backwards (a new simulation).
 */
export function usePopulationHistory(snapshot: SimSnapshot | null, info: SimInfo | null): PopulationSample[] {
    const [history, setHistory] = useState<PopulationSample[]>([]);
    const stride = useRef(SAMPLE_EVERY_TICKS);

    useEffect(() => {
        if (!snapshot || !info) return;
        setHistory((prev) => {
            const last = prev[prev.length - 1];
            if (last && snapshot.tick < last.tick) {
                stride.current = SAMPLE_EVERY_TICKS;
                prev = [];
            } else if (last && snapshot.tick - last.tick < stride.current) {
                return prev;
            }
            const counts = new Array<number>(info.species.length).fill(0);
            for (const row of snapshot.animals) counts[row[A.species]!]!++;
            let next = [...prev, { tick: snapshot.tick, counts }];
            if (next.length > MAX_SAMPLES) {
                next = next.filter((_, i) => i % 2 === 0 || i === next.length - 1);
                stride.current *= 2;
            }
            return next;
        });
    }, [snapshot, info]);

    return history;
}
