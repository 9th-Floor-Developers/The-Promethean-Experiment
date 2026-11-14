import { A, type SimInfo, type SimSnapshot } from '../sim/types';
import type { PopulationSample } from '../sim/usePopulationHistory';

interface Props {
    history: PopulationSample[];
    info: SimInfo | null;
    /** Latest snapshot; the graph always ends at its tick (the current day), even between stored samples. */
    snapshot: SimSnapshot | null;
}

/** Line colours, one per species in order. Chosen to read on the light panel background. */
const LINE_COLORS = ['#e8590c', '#2f9e44', '#1c7ed6', '#9c36b5', '#f08c00', '#0c8599'];
const W = 300;
const H = 140;
const PAD = { l: 28, r: 6, t: 6, b: 16 };

/** Rounds up to a "nice" axis maximum (4, 8, 10, 20, 50...) so the y axis does not jitter every sample. */
function niceMax(v: number): number {
    if (v <= 4) return 4;
    const mag = 10 ** Math.floor(Math.log10(v));
    for (const m of [1, 2, 5, 10]) if (v <= m * mag) return m * mag;
    return 10 * mag;
}

/**
 * Live population-versus-time graph: one line per species plus a dashed total.
 * Redraws whenever a new sample is appended to `history`; x is simulation days, y is living animals.
 * The right edge is always the current tick: a live point from `snapshot` is appended after the last stored sample.
 */
export function PopulationGraph({ history: stored, info, snapshot }: Props) {
    let history = stored;
    const last = stored[stored.length - 1];
    if (snapshot && info && last && snapshot.tick > last.tick) {
        const counts = new Array<number>(info.species.length).fill(0);
        for (const row of snapshot.animals) counts[row[A.species]!]!++;
        history = [...stored, { tick: snapshot.tick, counts }];
    }
    const body = history.length < 2 || !info
        ? <div className="panel__empty">Collecting data…</div>
        : (() => {
            const t0 = history[0]!.tick;
            const t1 = history[history.length - 1]!.tick;
            const span = Math.max(1, t1 - t0);
            const totals = history.map((s) => s.counts.reduce((a, b) => a + b, 0));
            const yMax = niceMax(Math.max(...totals));
            const x = (tick: number) => PAD.l + ((tick - t0) / span) * (W - PAD.l - PAD.r);
            const y = (v: number) => PAD.t + (1 - v / yMax) * (H - PAD.t - PAD.b);
            const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(history[i]!.tick).toFixed(1)},${y(v).toFixed(1)}`).join('');
            const days = (tick: number) => (tick / 1200 + 1).toFixed(1);
            return (
                <>
                    <svg className="popgraph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Population over time">
                        {[0, 0.5, 1].map((f) => (
                            <g key={f}>
                                <line x1={PAD.l} x2={W - PAD.r} y1={y(yMax * f)} y2={y(yMax * f)} stroke="#d5dcea" strokeWidth={1} />
                                <text x={PAD.l - 4} y={y(yMax * f) + 3} textAnchor="end" className="popgraph__tick">{Math.round(yMax * f)}</text>
                            </g>
                        ))}
                        <text x={PAD.l} y={H - 3} className="popgraph__tick">day {days(t0)}</text>
                        <text x={W - PAD.r} y={H - 3} textAnchor="end" className="popgraph__tick">day {days(t1)}</text>
                        {info.species.map((_, i) => (
                            <path key={i} d={path(history.map((s) => s.counts[i] ?? 0))} fill="none"
                                  stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={1.8} strokeLinejoin="round" />
                        ))}
                        <path d={path(totals)} fill="none" stroke="#1f2a44" strokeWidth={1.2} strokeDasharray="4 3" />
                    </svg>
                    <ul className="popgraph__legend">
                        {info.species.map((s, i) => (
                            <li key={s.name}>
                                <span className="popgraph__swatch" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                                {s.name} <strong>{history[history.length - 1]!.counts[i] ?? 0}</strong>
                            </li>
                        ))}
                        <li><span className="popgraph__swatch popgraph__swatch--total" />Total <strong>{totals[totals.length - 1]}</strong></li>
                    </ul>
                </>
            );
        })();

    return (
        <section className="panel" aria-labelledby="population-h">
            <h2 id="population-h" className="panel__header">Population Overview</h2>
            <div className="panel__body popgraph-body">{body}</div>
        </section>
    );
}
