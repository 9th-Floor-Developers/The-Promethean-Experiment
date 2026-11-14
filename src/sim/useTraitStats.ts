import { useEffect, useRef, useState } from 'react';
import { A, type SimInfo, type SimSnapshot } from './types';

/** The universal per-animal stats (docs/sim/SPECIES.md), as radar axes: label and the column of an animal row. */
export const TRAIT_AXES = [
    { label: 'Max HP', col: A.maxHp },
    { label: 'Speed', col: A.speed },
    { label: 'Damage', col: A.damage },
    { label: 'Armor', col: A.armor },
    { label: 'View range', col: A.viewRange },
    { label: 'Base stamina use', col: A.baseStaminaUsage },
    { label: 'Walking stamina use', col: A.walkingStaminaUsage },
    { label: 'Elderly age', col: A.elderlyAge },
] as const;

/** Min / mean / max of one stat over every animal of a species seen during the run. */
export interface TraitRange { min: number; avg: number; max: number }
/** Per species (indexed like SimInfo.species): count of animals seen, and a range per TRAIT_AXES entry. Null before any animal of the species exists. */
export type TraitStats = ({ count: number; traits: TraitRange[] } | null)[];

interface Acc { count: number; min: number[]; max: number[]; sum: number[] }

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
            const s = (a.perSpecies[sp] ??= { count: 0, min: TRAIT_AXES.map(() => Infinity), max: TRAIT_AXES.map(() => -Infinity), sum: TRAIT_AXES.map(() => 0) });
            s.count++;
            TRAIT_AXES.forEach((ax, i) => {
                const v = row[ax.col]!;
                if (v < s.min[i]!) s.min[i] = v;
                if (v > s.max[i]!) s.max[i] = v;
                s.sum[i]! += v;
            });
        }
        if (!changed && stats.length === info.species.length) return;
        setStats(info.species.map((_, sp) => {
            const s = a.perSpecies[sp];
            return s ? { count: s.count, traits: TRAIT_AXES.map((_, i) => ({ min: s.min[i]!, max: s.max[i]!, avg: s.sum[i]! / s.count })) } : null;
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [snapshot, info]);

    return stats;
}
