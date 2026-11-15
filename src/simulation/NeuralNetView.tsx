import { BRAIN_INPUTS, BRAIN_OUTPUTS, type BrainInfo } from '../sim/types';

/** Most neurons drawn per layer; bigger layers show the first ones and a "+n" note. */
const MAX_DRAWN = 14;
const W = 280;
/** Space for the input labels (left) and output labels (right). */
const LEFT = 78, RIGHT = 74;
const ROW = 13;
const POSITIVE = '#5eb0ff';
const NEGATIVE = '#ff9f5a';

/**
 * A basic drawing of a neural-network animal's brain: one column of neurons per layer (inputs left, drives right),
 * lines for the connections (blue = positive weight, orange = negative, stronger = more opaque). Input neurons glow
 * with what the animal senses now; the drive it wants most is highlighted.
 */
export function NeuralNetView({ brain }: { brain: BrainInfo }) {
    const { sizes, weights, inputs, outputs } = brain;
    const drawn = sizes.map((n) => Math.min(n, MAX_DRAWN));
    const H = Math.max(...drawn) * ROW + 16;
    const colX = (l: number) => LEFT + (l / (sizes.length - 1)) * (W - LEFT - RIGHT);
    const rowY = (l: number, i: number) => H / 2 + (i - (drawn[l]! - 1) / 2) * ROW;
    const best = outputs.indexOf(Math.max(...outputs));

    const edges = [];
    for (let l = 0; l < sizes.length - 1; l++) {
        const inN = sizes[l]!;
        for (let j = 0; j < drawn[l + 1]!; j++) {
            for (let i = 0; i < drawn[l]!; i++) {
                const w = weights[l]?.[j * inN + i] ?? 0;
                const a = Math.min(1, Math.abs(w)) * 0.7;
                if (a < 0.05) continue;
                edges.push(<line key={`${l}-${j}-${i}`} x1={colX(l)} y1={rowY(l, i)} x2={colX(l + 1)} y2={rowY(l + 1, j)}
                                 stroke={w >= 0 ? POSITIVE : NEGATIVE} strokeOpacity={a} strokeWidth={0.8} />);
            }
        }
    }

    return (
        <figure className="netview">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Neural network with layers ${sizes.join(', ')}`}>
                {edges}
                {sizes.map((n, l) => (
                    <g key={l}>
                        {Array.from({ length: drawn[l]! }, (_, i) => {
                            const isIn = l === 0, isOut = l === sizes.length - 1;
                            const glow = isIn ? Math.max(0, Math.min(1, Math.abs(inputs[i] ?? 0))) : isOut && i === best ? 1 : 0.25;
                            return (
                                <circle key={i} cx={colX(l)} cy={rowY(l, i)} r={isOut && i === best ? 4.2 : 3.2}
                                        fill={isOut && i === best ? '#ffd25e' : `rgba(232, 238, 252, ${0.2 + 0.8 * glow})`} stroke="#2a3656" strokeWidth={0.8}>
                                    <title>{isIn ? `${BRAIN_INPUTS[i]}: ${(inputs[i] ?? 0).toFixed(2)}` : isOut ? `${BRAIN_OUTPUTS[i]}: ${(outputs[i] ?? 0).toFixed(2)}` : `Hidden layer ${l}, neuron ${i + 1}`}</title>
                                </circle>
                            );
                        })}
                        {n > drawn[l]! && <text x={colX(l)} y={H - 2} textAnchor="middle" className="netview__more">+{n - drawn[l]!}</text>}
                    </g>
                ))}
                {Array.from({ length: drawn[0]! }, (_, i) => (
                    <text key={`in${i}`} x={colX(0) - 6} y={rowY(0, i) + 2.5} textAnchor="end" className="netview__label">{BRAIN_INPUTS[i]}</text>
                ))}
                {Array.from({ length: drawn[sizes.length - 1]! }, (_, i) => (
                    <text key={`out${i}`} x={colX(sizes.length - 1) + 7} y={rowY(sizes.length - 1, i) + 2.5}
                          className={`netview__label${i === best ? ' netview__label--best' : ''}`}>{BRAIN_OUTPUTS[i]} {(outputs[i] ?? 0).toFixed(1)}</text>
                ))}
            </svg>
            <figcaption className="netview__caption">
                Layers {sizes.join(' → ')} · remembers {brain.own} own and {brain.observed} observed decisions
            </figcaption>
        </figure>
    );
}
