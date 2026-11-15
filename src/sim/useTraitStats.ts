import { useEffect, useRef, useState } from 'react';
import { A, type SimInfo, type SimSnapshot } from './types';

/** The universal per-animal stats (docs/sim/SPECIES.md), as radar axes: label and the column of an animal row. */
/** `invert` axes are drawn flipped (low usage = far out), since a lower value is the better one. */
/** `brain` axes only exist for animals with a neural network (the value is -1 otherwise); the radar leaves them out for instinct species. */
/**
 * `median` axes report the median rather than the mean as their typical value, because a mean is dragged about by the
 * tail: intelligence starts low for every founder, so an average over the whole run understates where the population
 * has actually got to. Only whole-number axes may be flagged, since the median is counted in an integer histogram.
 */
export const TRAIT_AXES: readonly { label: string; col: number; invert?: boolean; brain?: boolean; median?: boolean }[] = [
    { label: 'Max HP', col: A.maxHp },
    { label: 'Speed', col: A.speed },
    { label: 'Damage', col: A.damage },
    { label: 'Armor', col: A.armor },
    { label: 'View range', col: A.viewRange },
    { label: 'Base stamina use', col: A.baseStaminaUsage, invert: true },
    { label: 'Walking stamina use', col: A.walkingStaminaUsage, invert: true },
    { label: 'Elderly age', col: A.elderlyAge },
    { label: 'Intelligence', col: A.intelligence, brain: true, median: true },
];

/** Min / mean / max of one stat over every animal of a species seen during the run. */
export interface TraitRange {
    min: number;
    avg: number;
    max: number;
    /** Median of the stat, present only on axes flagged `median` in [TRAIT_AXES]. Use [typical] rather than reading it directly. */
    median?: number;
}

/**
 * The single value that stands for an axis: its median where one is kept, else its mean. The radar plots this, so a
 * `median` axis needs no special case at the drawing end.
 */
export const typical = (t: TraitRange): number => t.median ?? t.avg;
/** Per species (indexed like SimInfo.species): count of animals seen, and a range per TRAIT_AXES entry. Null before any animal of the species exists. */
export type TraitStats = ({ count: number; traits: TraitRange[]} | null)[];

interface Acc {
    count: number;
    min: number[];
    max: number[];
    sum: number[];
    /** Per axis, how many animals had each whole value - kept only for `median` axes, and null for every other. */
    counts: (Map<number, number> | null)[];
}

/**
 * Exact median of the values tallied in [counts]. A histogram is enough because only whole-number axes are flagged
 * `median`, and it stays small however many animals live: one entry per distinct value, not per animal. With an even
 * number of animals this is the mean of the two middle values, as a median normally is.
 */
function medianOf(counts: Map<number, number>, total: number): number {
    const keys = [...counts.keys()].sort((a, b) => a - b);
    const lower = (total - 1) / 2, upper = total / 2;
    let seen = 0, lo = keys[0] ?? 0, hi = lo;
    for (const k of keys) {
        const next = seen + counts.get(k)!;
        if (seen <= lower && lower < next) lo = k;
        if (seen <= upper && upper < next) { hi = k; break; }
        seen = next;
    }
    return (lo + hi) / 2;
}

/**
 * Accumulates the universal stats of every animal that ever lived (each id counted once, when first seen), per species.
 * These stats are fixed for an animal's life, so one sighting is enough. Restarts when the tick counter goes backwards (a new simulation).
 */
export function useTraitStats(snapshot: SimSnapshot | null, info: SimInfo | null): TraitStats {
    const acc = useRef<{ seen: Set<number>; perSpecies: (Acc | null)[]; lastTick: number }>({ seen: new Set(), perSpecies: [], lastTick: -1 });
    const [stats, setStats] = useState<TraitStats>([]);

    useEffect(() => {
        if (!snapshot || !info) return;
        const a = acc.current;
        if (snapshot.tick < a.lastTick) { a.seen = new Set(); a.perSpecies = []; }
        a.lastTick = snapshot.tick;
        let changed = false;
        for (const row of snapshot.animals) {
            const id = row[A.id]!;
            if (a.seen.has(id)) continue;
            a.seen.add(id);
            changed = true;
            const sp = row[A.species]!;
            const s = (a.perSpecies[sp] ??= { count: 0, min: TRAIT_AXES.map(() => Infinity), max: TRAIT_AXES.map(() => -Infinity), sum: TRAIT_AXES.map(() => 0), counts: TRAIT_AXES.map((ax) => (ax.median ? new Map<number, number>() : null)) });
            s.count++;
            TRAIT_AXES.forEach((ax, i) => {
                const v = row[ax.col]!;
                if (v < s.min[i]!) s.min[i] = v;
                if (v > s.max[i]!) s.max[i] = v;
                s.sum[i]! += v;
                const c = s.counts[i];
                if (c) c.set(v, (c.get(v) ?? 0) + 1);
            });
        }
        if (!changed && stats.length === info.species.length) return;
        setStats(info.species.map((_, sp) => {
            const s = a.perSpecies[sp];
            if (!s) return null;
            return { count: s.count, traits: TRAIT_AXES.map((_, i) => {
                const c = s.counts[i];
                return { min: s.min[i]!, max: s.max[i]!, avg: s.sum[i]! / s.count, ...(c ? { median: medianOf(c, s.count) } : {}) };
            }) };
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [snapshot, info]);

    return stats;
}
