import { A, type SimInfo, type SimSnapshot } from '../sim/types';
import type { PopulationSample } from '../sim/usePopulationHistory';

interface Props {
    history: PopulationSample[];
    info: SimInfo | null;
    /** Latest snapshot; the graph always ends at its tick (the current day), even between stored samples. */
    snapshot: SimSnapshot | null;
}

/** Ticks per in-game day. */
const TICKS_PER_DAY = 1200;
/** The live sidebar graph only shows this many of the most recent days. */
export const LIVE_WINDOW_DAYS = 7;

/** Line colours, one per species in order. Chosen to read on the dark panel background. */
const LINE_COLORS = ['#ff9f5a', '#6fd47f', '#5eb0ff', '#c993ff', '#ffd25e', '#4fd8d0'];
const GRID = 'rgba(255, 255, 255, 0.14)';
const TOTAL_COLOR = '#e8eefc';
const PAD = { l: 28, r: 6, t: 6, b: 16 };

/** Rounds up to a "nice" axis maximum (4, 8, 10, 20, 50...) so the y axis does not jitter every sample. */
function niceMax(v: number): number {
    if (v <= 4) return 4;
    const mag = 10 ** Math.floor(Math.log10(v));
    for (const m of [1, 2, 5, 10]) if (v <= m * mag) return m * mag;
    return 10 * mag;
}

/** Appends a live point from `snapshot` after the last stored sample so the graph's right edge is the current tick. */
function withLivePoint(stored: PopulationSample[], info: SimInfo | null, snapshot: SimSnapshot | null): PopulationSample[] {
    const last = stored[stored.length - 1];
    if (!snapshot || !info || !last || snapshot.tick <= last.tick) return stored;
    const counts = new Array<number>(info.species.length).fill(0);
    for (const row of snapshot.animals) counts[row[A.species]!]!++;
    return [...stored, { tick: snapshot.tick, counts }];
}

interface ChartProps extends Props {
    /** Show only the last this-many days; omit to show the entire history. */
    windowDays?: number;
    /** Drawn size (SVG viewBox); bigger for the end-of-simulation view. */
    width?: number;
    height?: number;
}

/**
 * Population-versus-time chart: one line per species plus a dashed total, with a legend of the latest counts.
 * x is simulation days, y is living animals. The full `history` is never trimmed; `windowDays` only picks what is drawn.
 */
export function PopulationChart({ history: stored, info, snapshot, windowDays, width = 300, height = 140 }: ChartProps) {
    const all = withLivePoint(stored, info, snapshot);
    if (all.length < 2 || !info) return <div className="panel__empty">Collecting data…</div>;

    const t1 = all[all.length - 1]!.tick;
    const t0 = windowDays === undefined ? all[0]!.tick : Math.max(all[0]!.tick, t1 - windowDays * TICKS_PER_DAY);
    const history = all.filter((s) => s.tick >= t0);
    const span = Math.max(1, t1 - t0);
    const totals = history.map((s) => s.counts.reduce((a, b) => a + b, 0));
    const yMax = niceMax(Math.max(...totals));
    const W = width, H = height;
    const x = (tick: number) => PAD.l + ((tick - t0) / span) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - v / yMax) * (H - PAD.t - PAD.b);
    const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(history[i]!.tick).toFixed(1)},${y(v).toFixed(1)}`).join('');
    const days = (tick: number) => (tick / TICKS_PER_DAY + 1).toFixed(1);
    const latest = history[history.length - 1]!;
    return (
        <>
            <svg className="popgraph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Population over time">
                {[0, 0.5, 1].map((f) => (
                    <g key={f}>
                        <line x1={PAD.l} x2={W - PAD.r} y1={y(yMax * f)} y2={y(yMax * f)} stroke={GRID} strokeWidth={1} />
                        <text x={PAD.l - 4} y={y(yMax * f) + 3} textAnchor="end" className="popgraph__tick">{Math.round(yMax * f)}</text>
                    </g>
                ))}
                <text x={PAD.l} y={H - 3} className="popgraph__tick">day {days(t0)}</text>
                <text x={W - PAD.r} y={H - 3} textAnchor="end" className="popgraph__tick">day {days(t1)}</text>
                {info.species.map((_, i) => (
                    <path key={i} d={path(history.map((s) => s.counts[i] ?? 0))} fill="none"
                          stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={1.8} strokeLinejoin="round" />
                ))}
                <path d={path(totals)} fill="none" stroke={TOTAL_COLOR} strokeWidth={1.2} strokeDasharray="4 3" />
            </svg>
            <ul className="popgraph__legend">
                {info.species.map((s, i) => (
                    <li key={s.name}>
                        <span className="popgraph__swatch" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                        {s.name} <strong>{latest.counts[i] ?? 0}</strong>
                    </li>
                ))}
                <li><span className="popgraph__swatch popgraph__swatch--total" />Total <strong>{totals[totals.length - 1]}</strong></li>
            </ul>
        </>
    );
}

/** Sidebar panel: the live population graph covering only the last {@link LIVE_WINDOW_DAYS} days. */
export function PopulationGraph(props: Props) {
    return (
        <section className="panel" aria-labelledby="population-h">
            <h2 id="population-h" className="panel__header">Population · last {LIVE_WINDOW_DAYS} days</h2>
            <div className="panel__body popgraph-body">
                <PopulationChart {...props} windowDays={LIVE_WINDOW_DAYS} />
            </div>
        </section>
    );
}

/** Large overlay shown when the simulation has ended: the population over the entire run. */
export function SimulationSummary({ onClose, ...props }: Props & { onClose: () => void }) {
    return (
        <div className="sim-summary" role="dialog" aria-labelledby="summary-h">
            <section className="panel sim-summary__card">
                <h2 id="summary-h" className="panel__header">Simulation ended · full population history</h2>
                <div className="panel__body popgraph-body">
                    <PopulationChart {...props} width={720} height={320} />
                </div>
                <button className="sim-summary__close" onClick={onClose}>Close</button>
            </section>
        </div>
    );
}
