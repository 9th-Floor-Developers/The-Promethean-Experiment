import { useEffect, useRef, useState } from 'react';
import type { KotlinSimulation } from './kotlinSim';
import type { SimSnapshot } from './types';

/** Base simulation speed (speed 1): ticks advanced per real second (1200 ticks = one in-game day, so 40 s per day). */
export const TICKS_PER_SECOND = 30;
/** Cap per frame so a slow frame or a background tab cannot trigger a long freeze catching up. */
const MAX_TICKS_PER_FRAME = 20;

/** Allowed simulation speed multipliers (1 = base speed). */
export const MIN_SPEED = 1;
export const MAX_SPEED = 5;

/**
 * Drives the Kotlin simulation in real time while `running` and returns its latest snapshot.
 * `speed` multiplies the tick rate (MIN_SPEED..MAX_SPEED); changing it does not restart the loop.
 * One requestAnimationFrame loop; the simulation itself lives in Wasm, React only holds the latest snapshot.
 */
export function useSimulation(sim: KotlinSimulation | null, running: boolean, speed: number): SimSnapshot | null {
    const [snapshot, setSnapshot] = useState<SimSnapshot | null>(null);
    const speedRef = useRef(speed);
    speedRef.current = speed;

    useEffect(() => {
        if (!sim) return;
        setSnapshot(sim.snapshot());
        if (!running) return;
        let frame = 0;
        let last = performance.now();
        let owed = 0;
        const loop = (now: number) => {
            frame = requestAnimationFrame(loop);
            owed += ((now - last) / 1000) * TICKS_PER_SECOND * speedRef.current;
            last = now;
            const ticks = Math.min(Math.floor(owed), MAX_TICKS_PER_FRAME);
            owed -= Math.floor(owed);
            if (ticks > 0) {
                sim.tick(ticks);
                setSnapshot(sim.snapshot());
            }
        };
        frame = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frame);
    }, [sim, running]);

    return snapshot;
}
