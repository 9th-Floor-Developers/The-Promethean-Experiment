import { useState } from 'react';
import type { SimInfo } from '../sim/types';
import { TRAIT_AXES, type TraitStats } from '../sim/useTraitStats';
import { Hint } from '../ui/Hint';
import { CHART_HELP } from '../ui/helpText';

interface Props {
    info: SimInfo | null;
    stats: TraitStats;
}

const SIZE = 360;
const C = SIZE / 2;
const R = 110;
const RINGS = 4;
const START_COLOR = '#5eb0ff';
const NOW_COLOR = '#ff9f5a';

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
    /** Indices into TRAIT_AXES shown for this species: brain axes (intelligence) only when its animals have a network. */
    const shown = TRAIT_AXES.map((_, i) => i).filter((i) => !TRAIT_AXES[i]!.brain || (data?.traits[i]?.max ?? -1) >= 0);
    const n = shown.length;
    const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const pt = (i: number, f: number): [number, number] => [C + Math.cos(angle(i)) * R * f, C + Math.sin(angle(i)) * R * f];
    const base = info.species[sp]!.base as number[] | undefined; // missing only when the wasm build predates the field
    /** Axis range: lowest to highest value among the animals, widened to include the species' base value so both shapes share one scale. */
    const range = (i: number): [number, number] => {
        const t = data!.traits[i]!;
        const b = base?.[i];
        return b === undefined ? [t.min, t.max] : [Math.min(t.min, b), Math.max(t.max, b)];
    };
    /** Position (0 = axis minimum, 1 = axis maximum) of each value; inverted axes are flipped, flat axes sit at mid-range. */
    const frac = (vals: number[]) => (i: number) => {
        const [lo, hi] = range(i);
        if (hi <= lo) return 0.5;
        const f = Math.min(1, Math.max(0, (vals[i]! - lo) / (hi - lo)));
        return TRAIT_AXES[i]!.invert ? 1 - f : f;
    };
    /** Polygon through the shown axes; [f] takes a TRAIT_AXES index, the drawn position is the axis' place on the radar. */
    const poly = (f: (i: number) => number) => shown.map((ai, k) => pt(k, f(ai)).join(',')).join(' ');

    return (
        <section className="radar">
            <div className="radar__head">
                <h3 className="radar__title"><Hint text={CHART_HELP.radar}>Species traits</Hint></h3>
                <select value={sp} onChange={(e) => setPicked(Number(e.target.value))} aria-label="Species to show" title="Which species this chart shows.">
                    {info.species.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
                </select>
            </div>
            {!data ? <div className="panel__empty">No animals of this species yet…</div> : (
                <svg className="radar__svg" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Average traits of ${info.species[sp]!.name}`}>
                    {Array.from({ length: RINGS }, (_, k) => (
                        <polygon key={k} points={poly(() => (k + 1) / RINGS)} fill="none" stroke="rgba(255,255,255,0.14)" />
                    ))}
                    {shown.map((_, k) => <line key={k} x1={C} y1={C} x2={pt(k, 1)[0]} y2={pt(k, 1)[1]} stroke="rgba(255,255,255,0.14)" />)}
                    {base && <polygon fill="rgba(94,176,255,0.25)" stroke={START_COLOR} strokeWidth={2} strokeDasharray="5 3" points={poly(frac(base))} />}
                    <polygon fill="rgba(255,159,90,0.35)" stroke={NOW_COLOR} strokeWidth={2} points={poly(frac(data.traits.map((t) => t.avg)))} />
                    {shown.map((i, k) => {
                        const ax = TRAIT_AXES[i]!;
                        const t = data.traits[i]!;
                        const [x, y] = pt(k, 1.2);
                        const anchor = Math.abs(x - C) < 8 ? 'middle' : x > C ? 'start' : 'end';
                        return (
                            <text key={ax.label} x={x} y={y} textAnchor={anchor} className="radar__label">
                                <tspan x={x} dy="-0.2em">{ax.label}{ax.invert ? ' (inverted)' : ''}</tspan>
                                <tspan x={x} dy="1.15em" className="radar__sub">avg {fmt(t.avg)} · {fmt(range(i)[0])}–{fmt(range(i)[1])}</tspan>
                            </text>
                        );
                    })}
                </svg>
            )}
            {data && (
                <ul className="radar__legend">
                    <li><span className="radar__swatch radar__swatch--start" />{base ? 'Base stats (from Settings)' : 'Base stats unavailable — rebuild Kotlin (npm run kotlin) and reload'}</li>
                    <li><span className="radar__swatch" style={{ background: NOW_COLOR }} />Average of all animals so far</li>
                </ul>
            )}
            {data && <p className="radar__note">{data.count} animals seen · axis = lowest to highest value found (including the base value), shape = average; stamina axes inverted (lower use plots further out){n > 8 ? ' · intelligence = connections in the neural network' : ''}</p>}
        </section>
    );
}
