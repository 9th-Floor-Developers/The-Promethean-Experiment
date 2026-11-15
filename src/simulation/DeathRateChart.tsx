import { useState, type MouseEvent } from 'react';
import type { SimInfo } from '../sim/types';
import type { DeathRateSample } from '../sim/useDeathRates';
import { LINE_COLORS } from './PopulationGraph';

interface Props {
    info: SimInfo | null;
    samples: DeathRateSample[];
}

const TICKS_PER_DAY = 1200;
/** Each point is the rate over the in-game day before it. */
const WINDOW_TICKS = TICKS_PER_DAY;
/** No point is drawn until this many ticks of data exist, so the first moments do not spike. */
const MIN_SPAN_TICKS = 300;
/** At most this many points are drawn per line. */
const MAX_POINTS = 400;
const GRID = 'rgba(255, 255, 255, 0.14)';
const W = 600, H = 220;
const PAD = { l: 34, r: 8, t: 10, b: 22 };

/** One drawn point: its tick and per-species rate (null when the species had no living animals in the window). */
interface RatePoint { tick: number; rates: (number | null)[] }

/** Deaths from starvation or thirst per 100 animal-days over the day before each sample, per species. */
function ratePoints(samples: DeathRateSample[], speciesCount: number): RatePoint[] {
    const out: RatePoint[] = [];
    if (samples.length < 2) return out;
    const step = Math.max(1, Math.floor(samples.length / MAX_POINTS));
    let j = 0;
    for (let i = 0; i < samples.length; i += i + step < samples.length || i === samples.length - 1 ? step : samples.length - 1 - i) {
        const s = samples[i]!;
        if (s.tick - samples[0]!.tick < MIN_SPAN_TICKS) continue;
        while (j + 1 < i && samples[j + 1]!.tick <= s.tick - WINDOW_TICKS) j++;
        const from = samples[j]!;
        const rates = Array.from({ length: speciesCount }, (_, k) => {
            const [d1, t1] = s.perSpecies[k] ?? [0, 0];
            const [d0, t0] = from.perSpecies[k] ?? [0, 0];
            const animalDays = (t1 - t0) / TICKS_PER_DAY;
            return animalDays > 0.5 ? (100 * (d1 - d0)) / animalDays : null;
        });
        out.push({ tick: s.tick, rates });
        if (i === samples.length - 1) break;
    }
    return out;
}

/** Rounds up to a "nice" axis maximum so the y axis does not jitter. */
function niceMax(v: number): number {
    if (v <= 10) return 10;
    const mag = 10 ** Math.floor(Math.log10(v));
    for (const m of [1, 2, 5, 10]) if (v <= m * mag) return m * mag;
    return 10 * mag;
}

/**
 * Per-animal survival, independent of how many animals there are: deaths from starvation or thirst per 100 animal-days
 * (one animal living one day = one animal-day), over the in-game day before each point, one line per species.
 * A falling line means each animal copes better, e.g. neural-network animals learning to eat and drink.
 */
export function DeathRateChart({ info, samples }: Props) {
    const [hover, setHover] = useState<number | null>(null);
    const head = <div className="radar__head"><h3 className="radar__title">Thirst &amp; hunger deaths per 100 animal-days</h3></div>;
    if (!info) return null;
    const pts = ratePoints(samples, info.species.length);
    if (pts.length < 2) return <section className="radar radar--wide">{head}<div className="panel__empty">Collecting data…</div></section>;

    const t0 = pts[0]!.tick, t1 = pts[pts.length - 1]!.tick, span = Math.max(1, t1 - t0);
    const yMax = niceMax(Math.max(...pts.flatMap((p) => p.rates.filter((r): r is number => r !== null))));
    const x = (tick: number) => PAD.l + ((tick - t0) / span) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - Math.min(v, yMax) / yMax) * (H - PAD.t - PAD.b);
    const day = (tick: number) => (tick / TICKS_PER_DAY + 1).toFixed(1);
    /** SVG path for one species; a species with no animals leaves a gap. */
    const line = (k: number) => {
        let d = '', pen = false;
        for (const p of pts) {
            const r = p.rates[k];
            if (r === null || r === undefined) { pen = false; continue; }
            d += `${pen ? 'L' : 'M'}${x(p.tick).toFixed(1)},${y(r).toFixed(1)}`;
            pen = true;
        }
        return d;
    };

    const onMove = (e: MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const tick = t0 + (((e.clientX - rect.left) / rect.width) * W - PAD.l) / (W - PAD.l - PAD.r) * span;
        let idx = 0;
        for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i]!.tick - tick) < Math.abs(pts[idx]!.tick - tick)) idx = i;
        setHover(idx);
    };
    const hp = hover === null ? undefined : pts[Math.min(hover, pts.length - 1)];
    const fmt = (r: number | null | undefined) => (r === null || r === undefined ? '–' : r.toFixed(1));

    return (
        <section className="radar radar--wide">
            {head}
            <svg className="popgraph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Deaths from starvation or thirst per 100 animal-days, per species"
                 onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
                {[0, 0.5, 1].map((f) => (
                    <g key={f}>
                        <line x1={PAD.l} x2={W - PAD.r} y1={y(yMax * f)} y2={y(yMax * f)} stroke={GRID} />
                        <text x={PAD.l - 4} y={y(yMax * f) + 3} textAnchor="end" className="popgraph__tick">{Math.round(yMax * f)}</text>
                    </g>
                ))}
                <text x={PAD.l} y={H - 5} className="popgraph__tick">day {day(t0)}</text>
                <text x={W - PAD.r} y={H - 5} textAnchor="end" className="popgraph__tick">day {day(t1)}</text>
                {info.species.map((_, k) => (
                    <path key={k} d={line(k)} fill="none" stroke={LINE_COLORS[k % LINE_COLORS.length]} strokeWidth={1.8} strokeLinejoin="round" />
                ))}
                {hp && <line x1={x(hp.tick)} x2={x(hp.tick)} y1={PAD.t} y2={H - PAD.b} stroke="#e8eefc" strokeOpacity={0.5} pointerEvents="none" />}
            </svg>
            <ul className="radar__legend">
                {info.species.map((sp, k) => (
                    <li key={sp.name}>
                        <span className="radar__swatch" style={{ background: LINE_COLORS[k % LINE_COLORS.length] }} />
                        {sp.name} <strong>{fmt((hp ?? pts[pts.length - 1]!).rates[k])}</strong>
                    </li>
                ))}
            </ul>
            <p className="radar__note">
                {hp ? `Day ${day(hp.tick)}, over the day before. ` : ''}
                Counts per animal, not per population: a falling line means each animal copes better (for neural-network species, that it has learned to eat and drink).
            </p>
        </section>
    );
}
