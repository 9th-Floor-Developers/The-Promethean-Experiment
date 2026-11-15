import { useEffect, useRef, useState } from 'react';
import type { SimSnapshot } from './types';

/** Per-species running totals at one moment: the tick and, per species, [deaths from starvation or thirst, animal-ticks lived]. */
export interface DeathRateSample {
    tick: number;
    perSpecies: [number, number][];
}

/** Record a sample every this many ticks. */
const SAMPLE_EVERY_TICKS = 10;
/** When the history grows past this, every second sample is dropped and the sampling interval doubles. */
const MAX_SAMPLES = 20000;

/**
 * Accumulates the per-species starvation/thirst death and animal-time totals over time from the live snapshot stream
 * (Kotlin keeps the running totals), so deaths per animal-day can be drawn independently of population size.
 * Lives above the simulation screen so the history survives leaving and re-entering it.
 * Restarts if the tick counter goes backwards (a new simulation).
 */
export function useDeathRates(snapshot: SimSnapshot | null): DeathRateSample[] {
    const [samples, setSamples] = useState<DeathRateSample[]>([]);
    const stride = useRef(SAMPLE_EVERY_TICKS);

    useEffect(() => {
        if (!snapshot?.perSpecies) return; // missing only when the wasm build predates the field
        setSamples((prev) => {
            const last = prev[prev.length - 1];
            if (last && snapshot.tick < last.tick) {
                stride.current = SAMPLE_EVERY_TICKS;
                prev = [];
            } else if (last && snapshot.tick - last.tick < stride.current) {
                return prev;
            }
            let next = [...prev, { tick: snapshot.tick, perSpecies: snapshot.perSpecies! }];
            if (next.length > MAX_SAMPLES) {
                next = next.filter((_, i) => i % 2 === 0 || i === next.length - 1);
                stride.current *= 2;
            }
            return next;
        });
    }, [snapshot]);

    return samples;
}
