import { useEffect, useRef, useState } from 'react';
import { A, type SimInfo, type SimSnapshot } from './types';

/** One animal's end: the age in days it reached, and its intelligence (network connections) at birth, -1 for an instinct brain. */
export interface DeathRecord {
    age: number;
    intelligence: number;
}

/** Per species (indexed like SimInfo.species): one record per animal of that species that has died so far. */
export type Deaths = DeathRecord[][];

/**
 * Records the age of death and the brain size of every animal that dies during the run. An animal that was in the
 * previous snapshot but is missing from the current one has died; the last values seen for it are the ones kept
 * (both its age and its network size are fixed facts at that moment, so the last sighting is enough).
 * Restarts when the tick counter goes backwards (a new simulation).
 */
export function useDeaths(snapshot: SimSnapshot | null, info: SimInfo | null): Deaths {
    const acc = useRef<{ prev: Map<number, [number, DeathRecord]>; deaths: DeathRecord[][]; lastTick: number }>({ prev: new Map(), deaths: [], lastTick: -1 });
    const [deaths, setDeaths] = useState<Deaths>([]);

    useEffect(() => {
        if (!snapshot || !info) return;
        const a = acc.current;
        if (snapshot.tick < a.lastTick) { a.prev = new Map(); a.deaths = []; setDeaths([]); }
        a.lastTick = snapshot.tick;
        const now = new Map<number, [number, DeathRecord]>();
        for (const row of snapshot.animals) now.set(row[A.id]!, [row[A.species]!, { age: row[A.age]!, intelligence: row[A.intelligence]! }]);
        let changed = false;
        for (const [id, [sp, record]] of a.prev) {
            if (now.has(id)) continue;
            (a.deaths[sp] ??= []).push(record);
            changed = true;
        }
        a.prev = now;
        if (changed) setDeaths(info.species.map((_, sp) => [...(a.deaths[sp] ?? [])]));
    }, [snapshot, info]);

    return deaths;
}
