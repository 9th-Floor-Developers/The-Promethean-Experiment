import { BRAIN_INPUTS, BRAIN_OUTPUTS, type BrainInfo } from '../sim/types';
import { BRAIN_INPUT_HELP, BRAIN_OUTPUT_HELP } from '../ui/helpText';

/** Most neurons drawn per layer; bigger layers show the first ones and a "+n" note. */
const MAX_DRAWN = 14;
/** Space for the input labels (left) and output labels (right). */
const LEFT = 78, RIGHT = 74;
/** Width between the input and output columns for a one-hidden-layer brain; deeper brains get wider (see [COL_GAP]). */
const MIN_INNER = 128;
/** Narrowest gap between two layer columns, so a deep brain's columns and their "+n" notes stay apart. */
const COL_GAP = 34;
/** Height of the row of layer names above the columns. */
const HEAD = 12;
const ROW = 13;
const POSITIVE = '#5eb0ff';
const NEGATIVE = '#ff9f5a';

/** Short name shown above column [l] of a network with [layers] layers: senses, h1..hn, drives. */
const layerName = (l: number, layers: number) => (l === 0 ? 'senses' : l === layers - 1 ? 'drives' : `h${l}`);

/**
 * A basic drawing of a neural-network animal's brain: one column of neurons per layer (inputs left, drives right),
 * each named above it (h1, h2... for the hidden layers), with lines for the connections (blue = positive weight,
 * orange = negative, stronger = more opaque). The drawing widens with every hidden layer past the first, so a deep
 * brain's columns stay apart. Input neurons glow with what the animal senses now; the drive it wants most is highlighted.
 */
export function NeuralNetView({ brain }: { brain: BrainInfo }) {
    const { sizes, weights, inputs, outputs } = brain;
    const drawn = sizes.map((n) => Math.min(n, MAX_DRAWN));
    const inner = Math.max(MIN_INNER, (sizes.length - 1) * COL_GAP);
    const W = LEFT + inner + RIGHT;
    const H = HEAD + Math.max(...drawn) * ROW + 16;
    const colX = (l: number) => LEFT + (l / (sizes.length - 1)) * inner;
    const rowY = (l: number, i: number) => HEAD + (H - HEAD) / 2 + (i - (drawn[l]! - 1) / 2) * ROW;
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
                        <text x={colX(l)} y={HEAD - 3} textAnchor="middle" className="netview__layer">
                            {layerName(l, sizes.length)}
                            <title>{l === 0 ? `Senses: ${n} inputs.` : l === sizes.length - 1 ? `Drives: ${n} outputs, one per thing it can want.` : `Hidden layer ${l} of ${sizes.length - 2}: ${n} neurons.`}</title>
                        </text>
                        {Array.from({ length: drawn[l]! }, (_, i) => {
                            const isIn = l === 0, isOut = l === sizes.length - 1;
                            const glow = isIn ? Math.max(0, Math.min(1, Math.abs(inputs[i] ?? 0))) : isOut && i === best ? 1 : 0.25;
                            return (
                                <circle key={i} cx={colX(l)} cy={rowY(l, i)} r={isOut && i === best ? 4.2 : 3.2}
                                        fill={isOut && i === best ? '#ffd25e' : `rgba(232, 238, 252, ${0.2 + 0.8 * glow})`} stroke="#2a3656" strokeWidth={0.8}>
                                    <title>{isIn ? `${BRAIN_INPUTS[i]}: ${(inputs[i] ?? 0).toFixed(2)} — ${BRAIN_INPUT_HELP[i] ?? ''}`
                                        : isOut ? `${BRAIN_OUTPUTS[i]}: ${(outputs[i] ?? 0).toFixed(2)} — ${BRAIN_OUTPUT_HELP[i] ?? ''}`
                                        : `Hidden layer ${l}, neuron ${i + 1}. Hidden neurons are where the animal's learned behaviour lives.`}</title>
                                </circle>
                            );
                        })}
                        {n > drawn[l]! && <text x={colX(l)} y={H - 2} textAnchor="middle" className="netview__more">+{n - drawn[l]!}</text>}
                    </g>
                ))}
                {Array.from({ length: drawn[0]! }, (_, i) => (
                    <text key={`in${i}`} x={colX(0) - 6} y={rowY(0, i) + 2.5} textAnchor="end" className="netview__label">
                        {BRAIN_INPUTS[i]}<title>{`${BRAIN_INPUTS[i]}: what it senses now (${(inputs[i] ?? 0).toFixed(2)}). ${BRAIN_INPUT_HELP[i] ?? ''}`}</title>
                    </text>
                ))}
                {Array.from({ length: drawn[sizes.length - 1]! }, (_, i) => (
                    <text key={`out${i}`} x={colX(sizes.length - 1) + 7} y={rowY(sizes.length - 1, i) + 2.5}
                          className={`netview__label${i === best ? ' netview__label--best' : ''}`}>
                        {BRAIN_OUTPUTS[i]} {(outputs[i] ?? 0).toFixed(1)}
                        <title>{`${BRAIN_OUTPUTS[i]}: ${BRAIN_OUTPUT_HELP[i] ?? ''} The strongest drive is the one it acts on.`}</title>
                    </text>
                ))}
            </svg>
            <figcaption className="netview__caption"
                        title="Neurons per layer, from senses to drives, and how many past decisions it can learn from: its own, plus ones it watched other animals of its species make. It replays them while resting.">
                Layers {sizes.join(' → ')} ({sizes.length - 2} hidden) · remembers {brain.own} own and {brain.observed} observed decisions
            </figcaption>
        </figure>
    );
}
