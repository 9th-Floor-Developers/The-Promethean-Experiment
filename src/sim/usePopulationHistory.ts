import { useEffect, useRef, useState } from 'react';
import { A, type SimInfo, type SimSnapshot } from './types';

/** Brain size (hidden neurons) of the living animals of one species: [smallest, average, largest]. */
export type IntelRange = [min: number, avg: number, max: number];

/** One population sample: the tick it was taken at, the living animal count per species (indexed like SimInfo.species) and their brain sizes. */
export interface PopulationSample {
    tick: number;
    counts: number[];
    /**
     * Per species: the brain size of its living animals at this tick, or null when none is alive or the species
     * has no neural network (its animals report an intelligence of -1).
     */
    intel: (IntelRange | null)[];
}

/** Record a sample every this many ticks (30 ticks = 1 real second, so about 3 samples per second). */
const SAMPLE_EVERY_TICKS = 10;
/** When the history grows past this, every second sample is dropped and the sampling interval doubles. */
const MAX_SAMPLES = 20000;

/** Counts the living animals of each species in a snapshot and measures the brain sizes of those that have one. */
export function populationSample(snapshot: SimSnapshot, info: SimInfo): PopulationSample {
    const n = info.species.length;
    const counts = new Array<number>(n).fill(0);
    const brains = new Array<number>(n).fill(0);
    const sum = new Array<number>(n).fill(0);
    const min = new Array<number>(n).fill(Infinity);
    const max = new Array<number>(n).fill(-Infinity);
    for (const row of snapshot.animals) {
        const sp = row[A.species]!;
        counts[sp]!++;
        const iq = row[A.intelligence]!;
        if (iq < 0) continue; // instinct brain: no network to measure
        brains[sp]!++;
        sum[sp]! += iq;
        if (iq < min[sp]!) min[sp] = iq;
        if (iq > max[sp]!) max[sp] = iq;
    }
    const intel = info.species.map((_, sp) => (brains[sp]! > 0 ? [min[sp]!, sum[sp]! / brains[sp]!, max[sp]!] as IntelRange : null));
    return { tick: snapshot.tick, counts, intel };
}

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
            let next = [...prev, populationSample(snapshot, info)];
            if (next.length > MAX_SAMPLES) {
                next = next.filter((_, i) => i % 2 === 0 || i === next.length - 1);
                stride.current *= 2;
            }
            return next;
        });
    }, [snapshot, info]);

    return history;
}
