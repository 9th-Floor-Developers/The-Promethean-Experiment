import { useEffect, useRef, useState } from 'react';
import { A, type SimInfo, type SimSnapshot } from './types';

/** Per species (indexed like SimInfo.species): the age in days at which each animal of that species has died so far. */
export type DeathAges = number[][];

/**
 * Records the age of death of every animal that dies during the run. An animal that was in the previous snapshot
 * but is missing from the current one has died; the last age seen for it is its age of death.
 * Restarts when the tick counter goes backwards (a new simulation).
 */
export function useDeathAges(snapshot: SimSnapshot | null, info: SimInfo | null): DeathAges {
    const acc = useRef<{ prev: Map<number, [number, number]>; deaths: number[][]; lastTick: number }>({ prev: new Map(), deaths: [], lastTick: -1 });
    const [deaths, setDeaths] = useState<DeathAges>([]);

    useEffect(() => {
        if (!snapshot || !info) return;
        const a = acc.current;
        if (snapshot.tick < a.lastTick) { a.prev = new Map(); a.deaths = []; setDeaths([]); }
        a.lastTick = snapshot.tick;
        const now = new Map<number, [number, number]>();
        for (const row of snapshot.animals) now.set(row[A.id]!, [row[A.species]!, row[A.age]!]);
        let changed = false;
        for (const [id, [sp, age]] of a.prev) {
            if (now.has(id)) continue;
            (a.deaths[sp] ??= []).push(age);
            changed = true;
        }
        a.prev = now;
        if (changed) setDeaths(info.species.map((_, sp) => [...(a.deaths[sp] ?? [])]));
    }, [snapshot, info]);

    return deaths;
}
