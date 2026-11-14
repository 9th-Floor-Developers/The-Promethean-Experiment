import { useState } from 'react';
import type { SimInfo } from '../sim/types';
import { TRAIT_AXES, type TraitStats } from '../sim/useTraitStats';

interface Props {
    info: SimInfo | null;
    stats: TraitStats;
}

const SIZE = 360;
const C = SIZE / 2;
const R = 110;
const RINGS = 4;

const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2).replace(/\.?0+$/, ''));

/**
 * Radar of the universal stats of one species, picked from a dropdown. Each axis runs from the lowest to the highest value
 * found among all animals of the species (not from 0); the plotted shape is the average. An axis where every animal is equal sits at mid-range.
 */
export function TraitRadar({ info, stats }: Props) {
    const [picked, setPicked] = useState(0);
    if (!info) return null;
    const sp = Math.min(picked, info.species.length - 1);
    const data = stats[sp] ?? null;
    const n = TRAIT_AXES.length;
    const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const pt = (i: number, f: number): [number, number] => [C + Math.cos(angle(i)) * R * f, C + Math.sin(angle(i)) * R * f];
    const poly = (f: (i: number) => number) => TRAIT_AXES.map((_, i) => pt(i, f(i)).join(',')).join(' ');

    return (
        <section className="radar">
            <div className="radar__head">
                <h3 className="radar__title">Species traits</h3>
                <select value={sp} onChange={(e) => setPicked(Number(e.target.value))} aria-label="Species to show">
                    {info.species.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
                </select>
            </div>
            {!data ? <div className="panel__empty">No animals of this species yet…</div> : (
                <svg className="radar__svg" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Average traits of ${info.species[sp]!.name}`}>
                    {Array.from({ length: RINGS }, (_, k) => (
                        <polygon key={k} points={poly(() => (k + 1) / RINGS)} fill="none" stroke="rgba(255,255,255,0.14)" />
                    ))}
                    {TRAIT_AXES.map((_, i) => <line key={i} x1={C} y1={C} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} stroke="rgba(255,255,255,0.14)" />)}
                    <polygon fill="rgba(255,159,90,0.35)" stroke="#ff9f5a" strokeWidth={2}
                             points={poly((i) => { const t = data.traits[i]!; return t.max > t.min ? (t.avg - t.min) / (t.max - t.min) : 0.5; })} />
                    {TRAIT_AXES.map((ax, i) => {
                        const t = data.traits[i]!;
                        const [x, y] = pt(i, 1.2);
                        const anchor = Math.abs(x - C) < 8 ? 'middle' : x > C ? 'start' : 'end';
                        return (
                            <text key={ax.label} x={x} y={y} textAnchor={anchor} className="radar__label">
                                <tspan x={x} dy="-0.2em">{ax.label}</tspan>
                                <tspan x={x} dy="1.15em" className="radar__sub">avg {fmt(t.avg)} · {fmt(t.min)}–{fmt(t.max)}</tspan>
                            </text>
                        );
                    })}
                </svg>
            )}
            {data && <p className="radar__note">{data.count} animals seen · axis = lowest to highest value found, shape = average</p>}
        </section>
    );
}
