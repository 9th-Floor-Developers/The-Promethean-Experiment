import { useEffect, useRef, useState } from 'react';
import type { SimSnapshot } from './types';

/** Running death totals at one moment: the tick, animals killed by other animals, and animals dead of natural causes (starvation, thirst...). */
export interface DeathCauseSample {
    tick: number;
    predatory: number;
    natural: number;
}

/** Record a sample every this many ticks. */
const SAMPLE_EVERY_TICKS = 10;
/** When the history grows past this, every second sample is dropped and the sampling interval doubles. */
const MAX_SAMPLES = 20000;

/**
 * Accumulates the cause-of-death totals over time from the live snapshot stream (Kotlin keeps the running totals).
 * Lives above the simulation screen so the history survives leaving and re-entering it.
 * Restarts if the tick counter goes backwards (a new simulation).
 */
export function useDeathCauses(snapshot: SimSnapshot | null): DeathCauseSample[] {
    const [samples, setSamples] = useState<DeathCauseSample[]>([]);
    const stride = useRef(SAMPLE_EVERY_TICKS);

    useEffect(() => {
        if (!snapshot) return;
        setSamples((prev) => {
            const last = prev[prev.length - 1];
            if (last && snapshot.tick < last.tick) {
                stride.current = SAMPLE_EVERY_TICKS;
                prev = [];
            } else if (last && snapshot.tick - last.tick < stride.current) {
                return prev;
            }
            const [predatory, natural] = snapshot.deaths ?? [0, 0]; // missing only when the wasm build predates the field
            let next = [...prev, { tick: snapshot.tick, predatory, natural }];
            if (next.length > MAX_SAMPLES) {
                next = next.filter((_, i) => i % 2 === 0 || i === next.length - 1);
                stride.current *= 2;
            }
            return next;
        });
    }, [snapshot]);

    return samples;
}
