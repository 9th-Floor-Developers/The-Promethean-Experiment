import { useState, type MouseEvent } from 'react';
import type { DeathCauseSample } from '../sim/useDeathCauses';

interface Props {
    samples: DeathCauseSample[];
}

const PREDATORY_COLOR = '#ff9f5a';
const NATURAL_COLOR = '#5eb0ff';
const GRID = 'rgba(255, 255, 255, 0.14)';
const TICKS_PER_DAY = 1200;
const W = 300, H = 200;
const PAD = { l: 34, r: 8, t: 10, b: 22 };
const PIE_R = 70;

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** SVG path of a pie slice from angle `a0` to `a1` (radians, 0 = 12 o'clock, clockwise) around (cx, cy). */
function slice(cx: number, cy: number, r: number, a0: number, a1: number): string {
    const p = (a: number) => `${(cx + r * Math.sin(a)).toFixed(2)},${(cy - r * Math.cos(a)).toFixed(2)}`;
    return `M${cx},${cy} L${p(a0)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)} Z`;
}

/**
 * Cause-of-death statistics for the whole run (all species together): a pie of predatory vs natural deaths
 * (natural = starvation, dehydration, ...), and a line of the natural share of all deaths so far over time.
 * The line's top is 100% natural deaths, its bottom 100% predatory deaths.
 */
export function DeathCauseCharts({ samples }: Props) {
    const [hover, setHover] = useState<number | null>(null);
    const last = samples[samples.length - 1];
    const predatory = last?.predatory ?? 0, natural = last?.natural ?? 0, total = predatory + natural;
    if (total === 0) {
        return (
            <section className="radar radar--wide">
                <div className="radar__head"><h3 className="radar__title">Cause of death</h3></div>
                <div className="panel__empty">No animals have died yet…</div>
            </section>
        );
    }

    // The share is only defined once something has died.
    const pts = samples.filter((s) => s.predatory + s.natural > 0);
    const t0 = pts[0]!.tick, t1 = pts[pts.length - 1]!.tick, span = Math.max(1, t1 - t0);
    const x = (tick: number) => PAD.l + ((tick - t0) / span) * (W - PAD.l - PAD.r);
    const y = (share: number) => PAD.t + (1 - share) * (H - PAD.t - PAD.b);
    const share = (s: DeathCauseSample) => s.natural / (s.predatory + s.natural);
    const line = pts.map((s, i) => `${i ? 'L' : 'M'}${x(s.tick).toFixed(1)},${y(share(s)).toFixed(1)}`).join('');
    const day = (tick: number) => (tick / TICKS_PER_DAY + 1).toFixed(1);

    const onMove = (e: MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const tick = t0 + (((e.clientX - rect.left) / rect.width) * W - PAD.l) / (W - PAD.l - PAD.r) * span;
        let idx = 0;
        for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i]!.tick - tick) < Math.abs(pts[idx]!.tick - tick)) idx = i;
        setHover(idx);
    };
    const hs = hover === null ? undefined : pts[Math.min(hover, pts.length - 1)];

    const a = (predatory / total) * 2 * Math.PI;
    return (
        <section className="radar radar--wide">
            <div className="radar__head"><h3 className="radar__title">Cause of death</h3></div>
            <div className="deathcause">
                <figure className="deathcause__fig">
                    <svg viewBox="0 0 200 200" role="img" aria-label={`Deaths: ${predatory} predatory, ${natural} natural`}>
                        {predatory === 0 || natural === 0
                            ? <circle cx={100} cy={100} r={PIE_R} fill={predatory === 0 ? NATURAL_COLOR : PREDATORY_COLOR} />
                            : (
                                <>
                                    <path d={slice(100, 100, PIE_R, 0, a)} fill={PREDATORY_COLOR} stroke="#2a3656" strokeWidth={2}><title>{`Predatory: ${predatory}`}</title></path>
                                    <path d={slice(100, 100, PIE_R, a, 2 * Math.PI)} fill={NATURAL_COLOR} stroke="#2a3656" strokeWidth={2}><title>{`Natural: ${natural}`}</title></path>
                                </>
                            )}
                    </svg>
                    <ul className="radar__legend">
                        <li><span className="radar__swatch" style={{ background: PREDATORY_COLOR }} />Predatory {predatory} ({pct(predatory / total)})</li>
                        <li><span className="radar__swatch" style={{ background: NATURAL_COLOR }} />Natural {natural} ({pct(natural / total)})</li>
                    </ul>
                </figure>
                <figure className="deathcause__fig">
                    <svg className="popgraph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Share of natural deaths over time"
                         onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
                        {[0, 0.5, 1].map((f) => (
                            <g key={f}>
                                <line x1={PAD.l} x2={W - PAD.r} y1={y(f)} y2={y(f)} stroke={GRID} />
                                <text x={PAD.l - 4} y={y(f) + 3} textAnchor="end" className="popgraph__tick">{pct(f)}</text>
                            </g>
                        ))}
                        <text x={PAD.l + 3} y={PAD.t + 10} className="popgraph__tick" fill={NATURAL_COLOR}>100% natural</text>
                        <text x={PAD.l + 3} y={H - PAD.b - 4} className="popgraph__tick" fill={PREDATORY_COLOR}>100% predatory</text>
                        <text x={PAD.l} y={H - 5} className="popgraph__tick">day {day(t0)}</text>
                        <text x={W - PAD.r} y={H - 5} textAnchor="end" className="popgraph__tick">day {day(t1)}</text>
                        <path d={line} fill="none" stroke="#e8eefc" strokeWidth={1.8} strokeLinejoin="round" />
                        {hs && (
                            <g pointerEvents="none">
                                <line x1={x(hs.tick)} x2={x(hs.tick)} y1={PAD.t} y2={H - PAD.b} stroke="#e8eefc" strokeOpacity={0.5} />
                                <circle cx={x(hs.tick)} cy={y(share(hs))} r={3} fill="#e8eefc" />
                            </g>
                        )}
                    </svg>
                    <figcaption className="radar__note">
                        {hs ? `day ${day(hs.tick)}: ${pct(share(hs))} natural · ${pct(1 - share(hs))} predatory (${hs.natural + hs.predatory} deaths)` : 'Share of all deaths so far that were natural; hover for details'}
                    </figcaption>
                </figure>
            </div>
        </section>
    );
}
