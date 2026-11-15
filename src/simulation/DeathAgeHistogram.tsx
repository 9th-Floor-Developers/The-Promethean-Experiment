import { useState } from 'react';
import type { SimInfo } from '../sim/types';
import type { Deaths } from '../sim/useDeaths';
import { Hint } from '../ui/Hint';
import { CHART_HELP } from '../ui/helpText';

interface Props {
    info: SimInfo | null;
    deaths: Deaths;
}

const W = 360, H = 200;
const PAD = { l: 30, r: 8, t: 8, b: 30 };
const BAR_COLOR = '#ff9f5a';
const GRID = 'rgba(255, 255, 255, 0.14)';
const MAX_BINS = 12;

/** Rounds a bin width up to a readable step (0.5, 1, 2, 5, ... days). */
function niceStep(raw: number): number {
    const mag = 10 ** Math.floor(Math.log10(raw));
    for (const m of [1, 2, 5, 10]) if (raw <= m * mag) return m * mag;
    return 10 * mag;
}

/**
 * Histogram of the age (in days) at which animals of one species, picked from a dropdown, have died so far,
 * with the average lifespan. x = age at death, y = number of animals.
 */
export function DeathAgeHistogram({ info, deaths }: Props) {
    const [picked, setPicked] = useState(0);
    if (!info) return null;
    const sp = Math.min(picked, info.species.length - 1);
    const ages = (deaths[sp] ?? []).map((d) => d.age);

    let bars: { from: number; count: number }[] = [];
    let step = 1;
    if (ages.length) {
        const max = Math.max(...ages);
        step = niceStep(Math.max(max, 0.01) / MAX_BINS);
        const n = Math.floor(max / step) + 1;
        bars = Array.from({ length: n }, (_, i) => ({ from: i * step, count: 0 }));
        for (const a of ages) bars[Math.floor(a / step)]!.count++;
    }
    const avg = ages.length ? ages.reduce((s, v) => s + v, 0) / ages.length : 0;
    const yMax = Math.max(4, ...bars.map((b) => b.count));
    const pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b;
    const bw = bars.length ? pw / bars.length : 0;
    const fmt = (v: number) => v.toFixed(step < 1 ? 2 : 1).replace(/\.?0+$/, '');

    return (
        <section className="radar">
            <div className="radar__head">
                <h3 className="radar__title"><Hint text={CHART_HELP.deathAges}>Age of death</Hint></h3>
                <select value={sp} onChange={(e) => setPicked(Number(e.target.value))} aria-label="Species to show" title="Which species this chart shows.">
                    {info.species.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
                </select>
            </div>
            {!ages.length ? <div className="panel__empty">No animals of this species have died yet…</div> : (
                <svg className="popgraph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Age of death of ${info.species[sp]!.name}`}>
                    {[0, 0.5, 1].map((f) => {
                        const y = PAD.t + (1 - f) * ph;
                        return (
                            <g key={f}>
                                <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke={GRID} />
                                <text x={PAD.l - 4} y={y + 3} textAnchor="end" className="popgraph__tick">{Math.round(yMax * f)}</text>
                            </g>
                        );
                    })}
                    {bars.map((b, i) => {
                        const h = (b.count / yMax) * ph;
                        return (
                            <g key={i}>
                                <rect x={PAD.l + i * bw + 1} y={PAD.t + ph - h} width={Math.max(1, bw - 2)} height={h} fill={BAR_COLOR} fillOpacity={0.85}>
                                    <title>{`${fmt(b.from)}–${fmt(b.from + step)} days: ${b.count}`}</title>
                                </rect>
                                {(bars.length <= 6 || i % 2 === 0) && (
                                    <text x={PAD.l + i * bw} y={H - PAD.b + 12} textAnchor="middle" className="popgraph__tick">{fmt(b.from)}</text>
                                )}
                            </g>
                        );
                    })}
                    <text x={PAD.l + pw / 2} y={H - 4} textAnchor="middle" className="popgraph__tick">age at death (days)</text>
                    <line x1={PAD.l + (avg / step) * bw} x2={PAD.l + (avg / step) * bw} y1={PAD.t} y2={PAD.t + ph} stroke="#e8eefc" strokeDasharray="4 3" strokeWidth={1.2} />
                </svg>
            )}
            {ages.length > 0 && <p className="radar__note">{ages.length} deaths · average lifespan {avg.toFixed(2)} days (dashed line) · oldest {Math.max(...ages).toFixed(2)} days</p>}
        </section>
    );
}
