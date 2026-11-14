import { useEffect, useRef } from 'react';
import { drawAnimalPortrait } from '../scene/animalPortrait';

interface Props {
    carnivore: boolean;
    /** Latest simulation position (tile units) of the animal. */
    x: number;
    y: number;
}

/** Turn speed used to smooth the heading, matching the main scene's feel. */
const TURN = 12;

/**
 * A small live view of one animal: the model turns to face the direction it is moving in and bobs while walking.
 * Movement is derived from position changes between snapshots, so it needs no extra data from the simulation.
 */
export function AnimalPortrait({ carnivore, x, y }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pos = useRef({ x, y, moving: false, targetHeading: 0, lastChange: 0 });

    // Record movement whenever a new position arrives.
    useEffect(() => {
        const p = pos.current;
        const dx = x - p.x, dy = y - p.y;
        if (dx * dx + dy * dy > 1e-6) {
            p.targetHeading = Math.atan2(dx, dy);
            p.lastChange = performance.now();
        }
        p.x = x;
        p.y = y;
    }, [x, y]);

    // Animation loop for this portrait; lives as long as the row does.
    useEffect(() => {
        let frame = 0;
        let last = performance.now();
        let heading = pos.current.targetHeading;
        const loop = (now: number) => {
            frame = requestAnimationFrame(loop);
            const dt = Math.min(0.1, (now - last) / 1000);
            last = now;
            const p = pos.current;
            let d = p.targetHeading - heading;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            heading += d * (1 - Math.exp(-dt * TURN));
            const moving = now - p.lastChange < 250;
            const bob = moving ? Math.abs(Math.sin(now / 1000 * 12)) * 0.05 : 0;
            if (canvasRef.current) drawAnimalPortrait(canvasRef.current, carnivore, heading, bob);
        };
        frame = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frame);
    }, [carnivore]);

    return <canvas ref={canvasRef} className="portrait" width={72} height={72} aria-hidden="true" />;
}
