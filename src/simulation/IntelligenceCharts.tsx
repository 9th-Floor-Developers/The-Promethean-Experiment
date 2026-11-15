import { useState, type MouseEvent } from 'react';
import { A, type SimInfo, type SimSnapshot } from '../sim/types';
import { populationSample, type PopulationSample } from '../sim/usePopulationHistory';
import { TRAIT_AXES } from '../sim/useTraitStats';
import type { Deaths, DeathRecord } from '../sim/useDeaths';
import { LINE_COLORS } from './PopulationGraph';
import { Hint } from '../ui/Hint';
import { CHART_HELP } from '../ui/helpText';

interface Props {
    info: SimInfo | null;
    /** Population history; every sample also carries the brain sizes of the living animals (PopulationSample.intel). */
    history: PopulationSample[];
    /** Latest snapshot, so the trend ends at the current tick rather than at the last stored sample. */
    snapshot: SimSnapshot | null;
    deaths: Deaths;
}

const TICKS_PER_DAY = 1200;
const GRID = 'rgba(255, 255, 255, 0.14)';
const AXIS_TEXT = '#e8eefc';
/** At most this many points are drawn per trend line. */
const MAX_POINTS = 400;
/** At most this many dots are drawn in the scatter; the statistics always use every death. */
const MAX_DOTS = 1500;
/** Index of the intelligence value inside SpeciesInfo.base (the base array follows TRAIT_AXES). */
const BASE_INTEL = TRAIT_AXES.findIndex((ax) => ax.col === A.intelligence);

/** The indices of the species whose animals think with a neural network; the charts here are meaningless for the rest. */
export function neuralSpecies(info: SimInfo | null): number[] {
    if (!info) return [];
    return info.species.map((_, i) => i).filter((i) => info.species[i]!.traits.includes('SOFT_CODED'));
}

/**
 * Rounds up to a "nice" axis maximum so the axis does not jitter as the data grows. Works below 1 as well,
 * since animals that die young live a fraction of a day.
 */
function niceMax(v: number): number {
    if (!(v > 0)) return 1;
    const mag = 10 ** Math.floor(Math.log10(v));
    for (const m of [1, 1.5, 2, 3, 5, 10]) if (v <= m * mag) return m * mag;
    return 10 * mag;
}

/** Axis label with just enough decimals to tell the gridlines apart. */
const axisLabel = (v: number, span: number) => v.toFixed(span >= 10 ? 0 : span >= 2 ? 1 : 2);

const day = (tick: number) => (tick / TICKS_PER_DAY + 1).toFixed(1);

/** Appends a live point from `snapshot` so the chart's right edge is the current tick, exactly as the population chart does. */
function withLivePoint(stored: PopulationSample[], info: SimInfo, snapshot: SimSnapshot | null): PopulationSample[] {
    const last = stored[stored.length - 1];
    if (!snapshot || !last || snapshot.tick <= last.tick) return stored;
    return [...stored, populationSample(snapshot, info)];
}

const TREND_W = 600, TREND_H = 230;
const TREND_PAD = { l: 34, r: 8, t: 10, b: 26 };

/**
 * Brain size over the whole run, one line per neural-network species: the average number of hidden neurons among the
 * living animals, with a shaded band from the smallest to the largest brain alive. A dashed line marks the size the
 * founders started with, so a line above it means evolution has grown the brain and a line below it means the
 * stamina each neuron costs is not paying off. A species dies out as a gap at the end of its line.
 */
function IntelligenceTrend({ info, history, snapshot, shown }: { info: SimInfo; history: PopulationSample[]; snapshot: SimSnapshot | null; shown: number[] }) {
    const [hover, setHover] = useState<number | null>(null);
    const head = (
        <div className="radar__head">
            <h3 className="radar__title"><Hint text={CHART_HELP.intelligenceTrend}>Intelligence over time</Hint></h3>
        </div>
    );
    const all = withLivePoint(history, info, snapshot);
    // Only samples where at least one shown species had a living animal with a network say anything.
    const dense = all.filter((s) => shown.some((k) => s.intel[k]));
    if (dense.length < 2) return <section className="radar radar--wide">{head}<div className="panel__empty">Collecting data…</div></section>;
    const step = Math.max(1, Math.floor(dense.length / MAX_POINTS));
    const pts = dense.filter((_, i) => i % step === 0 || i === dense.length - 1);

    const t0 = pts[0]!.tick, t1 = pts[pts.length - 1]!.tick, span = Math.max(1, t1 - t0);
    const bases = [...new Set(shown.map((k) => info.species[k]!.base?.[BASE_INTEL]).filter((v): v is number => v !== undefined && v >= 0))];
    // Brain sizes drift by a few neurons around the founder value, so the axis is zoomed to the data (not to 0)
    // and always includes the founder line; otherwise the whole run would read as one flat line.
    const seen = pts.flatMap((s) => shown.flatMap((k) => (s.intel[k] ? [s.intel[k]![0], s.intel[k]![2]] : [])));
    const yLo = Math.max(0, Math.floor(Math.min(...seen, ...bases) - 1));
    const yHi = Math.ceil(Math.max(...seen, ...bases) + 1);
    const yRange = Math.max(1, yHi - yLo);
    const W = TREND_W, H = TREND_H, PAD = TREND_PAD;
    const x = (tick: number) => PAD.l + ((tick - t0) / span) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - (Math.min(Math.max(v, yLo), yHi) - yLo) / yRange) * (H - PAD.t - PAD.b);

    /** Mean-brain-size line for one species; a stretch with no living animals leaves a gap. */
    const line = (k: number) => {
        let d = '', pen = false;
        for (const s of pts) {
            const r = s.intel[k];
            if (!r) { pen = false; continue; }
            d += `${pen ? 'L' : 'M'}${x(s.tick).toFixed(1)},${y(r[1]).toFixed(1)}`;
            pen = true;
        }
        return d;
    };
    /** Smallest-to-largest band for one species, as one closed polygon per unbroken stretch of the line. */
    const band = (k: number) => {
        let d = '';
        let run: PopulationSample[] = [];
        const flush = () => {
            if (run.length > 1) {
                d += run.map((s, i) => `${i ? 'L' : 'M'}${x(s.tick).toFixed(1)},${y(s.intel[k]![2]).toFixed(1)}`).join('');
                d += [...run].reverse().map((s) => `L${x(s.tick).toFixed(1)},${y(s.intel[k]![0]).toFixed(1)}`).join('') + 'Z';
            }
            run = [];
        };
        for (const s of pts) {
            if (s.intel[k]) run.push(s); else flush();
        }
        flush();
        return d;
    };

    const onMove = (e: MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const tick = t0 + (((e.clientX - rect.left) / rect.width) * W - PAD.l) / (W - PAD.l - PAD.r) * span;
        let idx = 0;
        for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i]!.tick - tick) < Math.abs(pts[idx]!.tick - tick)) idx = i;
        setHover(idx);
    };
    const hs = hover === null ? undefined : pts[Math.min(hover, pts.length - 1)];
    const shownSample = hs ?? pts[pts.length - 1]!;
    const fmt = (v: number | undefined) => (v === undefined ? '–' : v.toFixed(1));

    return (
        <section className="radar radar--wide">
            {head}
            <svg className="popgraph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Average brain size of each neural-network species over time"
                 onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
                {[0, 0.5, 1].map((f) => {
                    const v = yLo + yRange * f;
                    return (
                        <g key={f}>
                            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={GRID} />
                            <text x={PAD.l - 4} y={y(v) + 3} textAnchor="end" className="popgraph__tick">{axisLabel(v, yRange)}</text>
                        </g>
                    );
                })}
                <text x={PAD.l} y={H - 5} className="popgraph__tick">day {day(t0)}</text>
                <text x={W - PAD.r} y={H - 5} textAnchor="end" className="popgraph__tick">day {day(t1)}</text>
                <text x={6} y={PAD.t + 2} className="popgraph__tick">hidden neurons</text>
                {bases.map((b) => (
                    <g key={b}>
                        <line x1={PAD.l} x2={W - PAD.r} y1={y(b)} y2={y(b)} stroke={AXIS_TEXT} strokeOpacity={0.55} strokeDasharray="4 3" />
                        <text x={W - PAD.r - 2} y={y(b) - 3} textAnchor="end" className="popgraph__tick">founders started at {b}</text>
                    </g>
                ))}
                {shown.map((k) => <path key={`b${k}`} d={band(k)} fill={LINE_COLORS[k % LINE_COLORS.length]} fillOpacity={0.14} stroke="none" />)}
                {shown.map((k) => (
                    <path key={k} d={line(k)} fill="none" stroke={LINE_COLORS[k % LINE_COLORS.length]} strokeWidth={1.8} strokeLinejoin="round" />
                ))}
                {hs && (
                    <g pointerEvents="none">
                        <line x1={x(hs.tick)} x2={x(hs.tick)} y1={PAD.t} y2={H - PAD.b} stroke={AXIS_TEXT} strokeOpacity={0.5} />
                        {shown.map((k) => hs.intel[k] && <circle key={k} cx={x(hs.tick)} cy={y(hs.intel[k]![1])} r={2.5} fill={LINE_COLORS[k % LINE_COLORS.length]} />)}
                    </g>
                )}
            </svg>
            <ul className="radar__legend">
                {shown.map((k) => (
                    <li key={info.species[k]!.name}>
                        <span className="radar__swatch" style={{ background: LINE_COLORS[k % LINE_COLORS.length] }} />
                        {info.species[k]!.name} <strong>{fmt(shownSample.intel[k]?.[1])}</strong>
                        {shownSample.intel[k] && <> ({shownSample.intel[k]![0]}–{shownSample.intel[k]![2]})</>}
                    </li>
                ))}
            </ul>
            <p className="radar__note">
                {hs ? `Day ${day(hs.tick)}. ` : 'Latest values. '}
                Average hidden neurons of the living animals (band = smallest to largest brain alive). Above the dashed line evolution has grown the brain; below it, the stamina each neuron costs is not paying off.
            </p>
        </section>
    );
}

const SC_W = 600, SC_H = 260;
const SC_PAD = { l: 38, r: 10, t: 12, b: 34 };
/** Horizontal spread of the dots within one brain size, in neurons, so animals of equal intelligence do not sit on one line. */
const JITTER = 0.34;

/** Pearson correlation of brain size and age of death; null when there is nothing to correlate (fewer than 3 deaths, or every brain the same size). */
function correlation(rows: DeathRecord[]): number | null {
    if (rows.length < 3) return null;
    const n = rows.length;
    const mx = rows.reduce((s, r) => s + r.intelligence, 0) / n;
    const my = rows.reduce((s, r) => s + r.age, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (const r of rows) {
        const dx = r.intelligence - mx, dy = r.age - my;
        sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    if (sxx <= 0 || syy <= 0) return null;
    return sxy / Math.sqrt(sxx * syy);
}

/** Plain-language reading of a correlation, so the number does not have to be interpreted by eye. */
function reading(r: number): string {
    const strength = Math.abs(r) < 0.1 ? 'no' : Math.abs(r) < 0.3 ? 'a weak' : Math.abs(r) < 0.6 ? 'a moderate' : 'a strong';
    if (strength === 'no') return 'no relationship between brain size and how long an animal lived';
    return `${strength} ${r > 0 ? 'positive' : 'negative'} relationship: bigger brains lived ${r > 0 ? 'longer' : 'less long'}`;
}

/** A deterministic −1..1 offset per dot, so the spread within a brain size is stable between renders instead of flickering. */
function jitterOf(i: number): number {
    const v = Math.sin((i + 1) * 12.9898) * 43758.5453;
    return (v - Math.floor(v)) * 2 - 1;
}

/**
 * Intelligence against lifespan for one species: a dot per animal that has died, placed by the brain size it was born
 * with (x) and the age it reached (y), plus the average lifespan at each brain size and the Pearson correlation of the
 * two. This is the chart that answers whether a bigger brain actually paid for itself in this run.
 */
function IntelligenceLifespan({ info, deaths, shown }: { info: SimInfo; deaths: Deaths; shown: number[] }) {
    const [picked, setPicked] = useState(shown[0]!);
    const sp = shown.includes(picked) ? picked : shown[0]!;
    const head = (
        <div className="radar__head">
            <h3 className="radar__title"><Hint text={CHART_HELP.intelligenceLifespan}>Intelligence vs lifespan</Hint></h3>
            <select value={sp} onChange={(e) => setPicked(Number(e.target.value))} aria-label="Species to show" title="Which neural-network species this chart shows.">
                {shown.map((k) => <option key={k} value={k}>{info.species[k]!.name}</option>)}
            </select>
        </div>
    );
    // An animal born before a species' network existed cannot happen, but a defensive filter keeps instinct rows (-1) out.
    const rows = (deaths[sp] ?? []).filter((d) => d.intelligence >= 0);
    if (rows.length < 2) return <section className="radar radar--wide">{head}<div className="panel__empty">Not enough animals of this species have died yet…</div></section>;

    const xs = rows.map((d) => d.intelligence);
    const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1;
    const yMax = niceMax(Math.max(...rows.map((d) => d.age)));
    const W = SC_W, H = SC_H, PAD = SC_PAD;
    const px = (v: number) => PAD.l + ((v - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
    const py = (v: number) => PAD.t + (1 - Math.min(v, yMax) / yMax) * (H - PAD.t - PAD.b);

    /** Average lifespan at each brain size that occurs, in ascending order of brain size. */
    const perSize = [...rows.reduce((m, d) => {
        const e = m.get(d.intelligence) ?? { n: 0, sum: 0 };
        e.n++; e.sum += d.age;
        return m.set(d.intelligence, e);
    }, new Map<number, { n: number; sum: number }>())].sort((a, b) => a[0] - b[0]);
    const trend = perSize.map(([iq, e], i) => `${i ? 'L' : 'M'}${px(iq).toFixed(1)},${py(e.sum / e.n).toFixed(1)}`).join('');

    // The dots are thinned for drawing only; the correlation and the averages use every death.
    const dotStep = Math.max(1, Math.ceil(rows.length / MAX_DOTS));
    const dots = rows.filter((_, i) => i % dotStep === 0);
    const r = correlation(rows);
    const color = LINE_COLORS[sp % LINE_COLORS.length]!;
    /** x ticks: every brain size when they are few, otherwise about eight evenly spaced ones. */
    const tickStep = Math.max(1, Math.ceil((x1 - x0) / 8));
    const ticks: number[] = [];
    for (let v = Math.ceil(x0); v <= Math.floor(x1); v += tickStep) ticks.push(v);

    return (
        <section className="radar radar--wide">
            {head}
            <svg className="popgraph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Brain size against age of death for ${info.species[sp]!.name}`} style={{ cursor: 'default' }}>
                {[0, 0.5, 1].map((f) => (
                    <g key={f}>
                        <line x1={PAD.l} x2={W - PAD.r} y1={py(yMax * f)} y2={py(yMax * f)} stroke={GRID} />
                        <text x={PAD.l - 4} y={py(yMax * f) + 3} textAnchor="end" className="popgraph__tick">{(yMax * f).toFixed(yMax < 4 ? 1 : 0)}</text>
                    </g>
                ))}
                {ticks.map((v) => (
                    <text key={v} x={px(v)} y={H - PAD.b + 13} textAnchor="middle" className="popgraph__tick">{v}</text>
                ))}
                <text x={PAD.l + (W - PAD.l - PAD.r) / 2} y={H - 4} textAnchor="middle" className="popgraph__tick">brain size at birth (hidden neurons)</text>
                <text x={6} y={PAD.t + 2} className="popgraph__tick">age at death (days)</text>
                {dots.map((d, i) => (
                    <circle key={i} cx={px(d.intelligence + jitterOf(i) * JITTER)} cy={py(d.age)} r={2} fill={color} fillOpacity={0.4} />
                ))}
                <path d={trend} fill="none" stroke={AXIS_TEXT} strokeWidth={1.6} strokeLinejoin="round" />
                {perSize.map(([iq, e]) => (
                    <circle key={iq} cx={px(iq)} cy={py(e.sum / e.n)} r={3} fill={AXIS_TEXT}>
                        <title>{`${iq} hidden neurons: ${e.n} animal${e.n === 1 ? '' : 's'}, average lifespan ${(e.sum / e.n).toFixed(2)} days`}</title>
                    </circle>
                ))}
            </svg>
            <ul className="radar__legend">
                <li><span className="radar__swatch" style={{ background: color }} />One animal that died</li>
                <li><span className="radar__swatch" style={{ background: AXIS_TEXT }} />Average lifespan at that brain size</li>
            </ul>
            <p className="radar__note">
                {rows.length} deaths · {perSize.length} brain size{perSize.length === 1 ? '' : 's'} seen ·{' '}
                {r === null ? 'too little variety to correlate yet' : `correlation r = ${r.toFixed(2)} — ${reading(r)}`}
                {dotStep > 1 ? ` · every ${dotStep}${dotStep === 2 ? 'nd' : dotStep === 3 ? 'rd' : 'th'} death drawn, all of them counted` : ''}
            </p>
        </section>
    );
}

/**
 * The statistics page's intelligence section: how brain size evolves over the run, and whether it buys a longer life.
 * Renders nothing at all when every species is instinctual, since both charts would have no data to show.
 */
export function IntelligenceCharts({ info, history, snapshot, deaths }: Props) {
    const shown = neuralSpecies(info);
    if (!info || shown.length === 0) return null;
    return (
        <>
            <IntelligenceTrend info={info} history={history} snapshot={snapshot} shown={shown} />
            <IntelligenceLifespan info={info} deaths={deaths} shown={shown} />
        </>
    );
}
