import { Leaderboard, type LeaderboardSettings } from './Leaderboard';
import { A, decodeEffects, type AnimalEffectId, type BrainInfo, type ObjectInfo, type SimInfo, type SimSnapshot } from '../sim/types';
import { NeuralNetView } from './NeuralNetView';
import { TraitChips } from './TraitIcons';
import { Hint } from '../ui/Hint';
import { STATS, type StatKey } from '../settings/speciesSettings';
import { ACTION_HELP, CALCULATED_HELP, EFFECT_HELP, OBJECT_HELP, STATUS_HELP } from '../ui/helpText';

const TICKS_PER_DAY = 1200;

interface Props {
    snapshot: SimSnapshot | null;
    info: SimInfo | null;
    selectedId: number | null;
    /** Selects an animal by id, or clears the selection with null. */
    onSelect: (id: number | null) => void;
    /** Looks up the details of a selected tree, grass tuft, carcass or egg. */
    objectInfoOf: ((id: number) => ObjectInfo | null) | null;
    /** Looks up the neural network of a SOFT_CODED animal (null for instinct animals). */
    brainOf: ((id: number) => BrainInfo | null) | null;
    /** Whether the camera is locked onto the selected animal. */
    following: boolean;
    leaderboardSettings: LeaderboardSettings;
    onLeaderboardSettingsChange: (settings: LeaderboardSettings) => void;
    onFollowChange: (following: boolean) => void;
}

/** The settings-screen explanation of an inherited stat, with a note that it is inherited. */
function statHelp(key: StatKey): string {
    return `${STATS.find((d) => d.key === key)!.help} ${CALCULATED_HELP.inherited}`;
}

/** "RUN_FROM_PREDATOR" -> "Run from predator". */
function actionLabel(name: string): string {
    const text = name.toLowerCase().replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A labelled status bar: `value` out of `max`, drawn as a filled track with the number beside it. The label explains itself on hover. */
function Meter({ label, value, max, tone, help }: { label: string; value: number; max: number; tone: string; help: string }) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return (
        <div className="meter">
            <Hint text={help} className="meter__label">{label}</Hint>
            <div className="meter__track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}>
                <div className={`meter__fill meter__fill--${tone}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="meter__value">{Math.round(value)}/{Math.round(max)}</span>
        </div>
    );
}

/** Friendly name for each animal effect shown in the inspector. */
const EFFECT_LABEL: Record<AnimalEffectId, string> = { POISONED: 'Poisoned', STARVING: 'Starving', DEHYDRATED: 'Dehydrated', TIRED: 'Tired' };

/** The animal's effects as hoverable labels ("none" when it has none); poisoned also shows how long the toxin lasts. */
function renderEffects(effects: AnimalEffectId[], toxinTicks: number) {
    if (effects.length === 0) return 'none';
    return effects.map((id, i) => (
        <span key={id}>
            {i > 0 && ', '}
            <Hint text={EFFECT_HELP[id]}>{EFFECT_LABEL[id]}{id === 'POISONED' ? ` (${formatTicks(toxinTicks)} left)` : ''}</Hint>
        </span>
    ));
}

/** A time in ticks as ticks plus in-game days, e.g. "300 ticks (0.25 days)". */
function formatTicks(ticks: number): string {
    return `${ticks} ticks (${(ticks / TICKS_PER_DAY).toFixed(2)} days)`;
}

const OBJECT_NAMES: Record<ObjectInfo['type'], string> = { TREE: 'Tree', GRASS: 'Grass', CARCASS: 'Carcass', EGG: 'Egg' };

/** Details of a selected tree, grass tuft, carcass or egg, including its cooldown. */
function ObjectDetails({ id, object, onBack }: { id: number; object: ObjectInfo; onBack: () => void }) {
    return (
        <>
            <div className="inspector__title">
                <strong>{OBJECT_NAMES[object.type]}</strong>
                <span className="inspector__id">#{id}</span>
                <button type="button" className="inspector__back" onClick={onBack}>← Leaderboard</button>
            </div>
            {(object.type === 'TREE' || object.type === 'GRASS') && (
                <>
                    <div className="inspector__action">
                        <Hint text={OBJECT_HELP.state} className="meter__label">State</Hint>
                        <span className="inspector__action-value">{object.edible ? 'Ready to eat' : 'Regrowing'}</span>
                    </div>
                    <Meter label="Regrowth" help={OBJECT_HELP.regrowth} value={object.cooldownTicks - object.cooldownRemaining} max={object.cooldownTicks} tone="stamina" />
                    <dl className="inspector__facts">
                        <dt><Hint text={OBJECT_HELP.cooldownLeft}>Cooldown left</Hint></dt><dd>{object.edible ? 'none' : formatTicks(object.cooldownRemaining)}</dd>
                        <dt><Hint text={OBJECT_HELP.cooldownFull}>Full cooldown</Hint></dt><dd>{formatTicks(object.cooldownTicks)}</dd>
                        <dt><Hint text={OBJECT_HELP.nutrition}>Nutrition</Hint></dt><dd>{object.nutrition}</dd>
                        <dt><Hint text={OBJECT_HELP.position}>Position</Hint></dt><dd>{object.x.toFixed(1)}, {object.y.toFixed(1)}</dd>
                    </dl>
                </>
            )}
            {object.type === 'CARCASS' && (
                <>
                    <Meter label="Meat left" help={OBJECT_HELP.meat} value={object.nutrition} max={object.initialNutrition} tone="nutrition" />
                    <dl className="inspector__facts">
                        <dt><Hint text={OBJECT_HELP.rot}>Rots away in</Hint></dt><dd>{formatTicks(object.rotTicksLeft)}</dd>
                        <dt><Hint text={OBJECT_HELP.nutrition}>Nutrition</Hint></dt><dd>{object.nutrition.toFixed(1)} of {object.initialNutrition.toFixed(1)}</dd>
                        <dt><Hint text={OBJECT_HELP.position}>Position</Hint></dt><dd>{object.x.toFixed(1)}, {object.y.toFixed(1)}</dd>
                    </dl>
                </>
            )}
            {object.type === 'EGG' && (
                <>
                    <Meter label="Hatching" help={OBJECT_HELP.hatching} value={object.hatchTicks - object.ticksLeft} max={object.hatchTicks} tone="hp" />
                    <dl className="inspector__facts">
                        <dt><Hint text={OBJECT_HELP.eggSpecies}>Species</Hint></dt><dd>{object.species}</dd>
                        <dt><Hint text={OBJECT_HELP.hatching}>Hatches in</Hint></dt><dd>{formatTicks(object.ticksLeft)}</dd>
                        <dt><Hint text={OBJECT_HELP.nutrition}>Nutrition</Hint></dt><dd>{object.nutrition.toFixed(1)}</dd>
                        <dt><Hint text={OBJECT_HELP.position}>Position</Hint></dt><dd>{object.x.toFixed(1)}, {object.y.toFixed(1)}</dd>
                    </dl>
                </>
            )}
        </>
    );
}

/** Shows the selected animal's status values (HP, stamina, nutrition, hydration, age), feelings and current action. */
export function IndividualInspector({ snapshot, info, selectedId, onSelect, objectInfoOf, brainOf, following, onFollowChange, leaderboardSettings, onLeaderboardSettingsChange }: Props) {
    const row = selectedId === null ? undefined : snapshot?.animals.find((r) => r[A.id] === selectedId);
    const species = row && info ? info.species[row[A.species]!] : undefined;
    // Re-read with every snapshot so the drawing shows what the brain senses and wants right now.
    const brain = row && brainOf && selectedId !== null && (row[A.intelligence] ?? -1) >= 0 ? brainOf(selectedId) : null;

    let body;
    if (selectedId === null) {
        body = null; // the leaderboard is shown instead, see below
    } else if (!row && info && objectInfoOf) {
        // Ids are shared by animals and objects, so an id that is not a living animal may be a tree, grass, carcass or egg.
        const object = objectInfoOf(selectedId);
        body = object
            ? <ObjectDetails id={selectedId} object={object} onBack={() => onSelect(null)} />
            : <div className="panel__empty">#{selectedId} no longer exists.</div>;
    } else if (!row || !species || !info) {
        body = <div className="panel__empty">Animal #{selectedId} is no longer alive.</div>;
    } else {
        // Feelings mean the same thing either way, but a neural-network animal's come out of its brain.
        const feelingsNote = (row[A.intelligence] ?? -1) >= 0 ? STATUS_HELP.softCodedFeelings : '';
        body = (
            <>
                <div className="inspector__title">
                    <strong>{species.name}</strong>
                    <span className="inspector__id">#{selectedId}</span>
                    <button type="button" className={`inspector__lock${following ? ' inspector__lock--on' : ''}`}
                            aria-pressed={following} aria-label="Lock camera on this animal"
                            title={following ? 'Unlock camera' : 'Lock camera on this animal'}
                            onClick={() => onFollowChange(!following)}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="6.5" />
                            <path d="M12 2v6M12 16v6M2 12h6M16 12h6" />
                        </svg>
                    </button>
                    <button type="button" className="inspector__back" onClick={() => onSelect(null)}>← Leaderboard</button>
                </div>
                <div className="inspector__action">
                    <Hint text={STATUS_HELP.action} className="meter__label">Action</Hint>
                    <Hint text={ACTION_HELP[info.actions[row[A.action]!] ?? ''] ?? STATUS_HELP.action} className="inspector__action-value">
                        {actionLabel(info.actions[row[A.action]!] ?? 'unknown')}
                    </Hint>
                </div>
                <Meter label="HP" help={STATUS_HELP.hp} value={row[A.hp]!} max={row[A.maxHp]!} tone="hp" />
                <Meter label="Stamina" help={STATUS_HELP.stamina} value={row[A.stamina]!} max={species.maxStamina} tone="stamina" />
                {/* Trait SPRINTING: only species that can sprint have a reserve to show. */}
                {species.traits.includes('SPRINTING') && (
                    <Meter label={row[A.sprinting] ? 'Sprint (running)' : 'Sprint'} help={STATUS_HELP.sprint} value={row[A.sprintCharge]!} max={species.sprintChargeTicks} tone="sprint" />
                )}
                <Meter label="Nutrition" help={STATUS_HELP.nutrition} value={row[A.nutrition]!} max={species.maxNutrition} tone="nutrition" />
                <Meter label="Hydration" help={STATUS_HELP.hydration} value={row[A.hydration]!} max={species.maxHydration} tone="hydration" />
                <dl className="inspector__facts">
                    <dt><Hint text={STATUS_HELP.age}>Age</Hint></dt><dd>{row[A.age]!.toFixed(2)} days</dd>
                    {/* Traits ALARM_CALLING and HEARING: only shown for species that actually have them. */}
                    {species.traits.includes('ALARM_CALLING') && (
                        <><dt><Hint text={STATUS_HELP.calling}>Alarm call</Hint></dt><dd>{row[A.calling] ? 'raising' : 'quiet'}</dd></>
                    )}
                    {species.traits.includes('HEARING') && (
                        <><dt><Hint text={STATUS_HELP.earshot}>Earshot</Hint></dt><dd>{species.hearingRange.toFixed(0)} tiles</dd></>
                    )}
                    {/* Effects (docs/sim/ANIMALS.MD): poisoned, starving, dehydrated, tired; any animal can be under any of them. */}
                    <dt><Hint text={STATUS_HELP.effects}>Effects</Hint></dt>
                    <dd>{renderEffects(decodeEffects(row[A.effects] ?? 0), row[A.toxinTicks] ?? 0)}</dd>
                    <dt><Hint text={STATUS_HELP.fear + feelingsNote}>Fear</Hint></dt><dd>{row[A.fear]!.toFixed(2)}</dd>
                    <dt><Hint text={STATUS_HELP.hunger + feelingsNote}>Hunger</Hint></dt><dd>{row[A.hunger]!.toFixed(2)}</dd>
                    <dt><Hint text={STATUS_HELP.thirst + feelingsNote}>Thirst</Hint></dt><dd>{row[A.thirst]!.toFixed(2)}</dd>
                    <dt><Hint text={STATUS_HELP.libido + feelingsNote}>Libido</Hint></dt><dd>{row[A.libido]!.toFixed(2)}</dd>
                </dl>
                <h3 className="inspector__subhead"><Hint text={CALCULATED_HELP.inherited}>Inherited stats</Hint></h3>
                <dl className="inspector__facts">
                    <dt><Hint text={statHelp('maxHp')}>Max HP</Hint></dt><dd>{row[A.maxHp]!.toFixed(1)}</dd>
                    <dt><Hint text={statHelp('speed')}>Speed</Hint></dt><dd>{row[A.speed]!.toFixed(3)} tiles/tick</dd>
                    <dt><Hint text={statHelp('damage')}>Damage</Hint></dt><dd>{row[A.damage]!.toFixed(2)}</dd>
                    <dt><Hint text={statHelp('armor')}>Armor</Hint></dt><dd>{row[A.armor]!.toFixed(1)}%</dd>
                    <dt><Hint text={statHelp('viewRange')}>View range</Hint></dt><dd>{row[A.viewRange]!.toFixed(1)} tiles</dd>
                </dl>
                <h3 className="inspector__subhead"><Hint text="Worked out from the inherited stats, so they change with them.">Calculated stats</Hint></h3>
                <dl className="inspector__facts">
                    <dt><Hint text={CALCULATED_HELP.baseStaminaUsage}>Base stamina use</Hint></dt><dd>{row[A.baseStaminaUsage]!.toFixed(4)}/tick</dd>
                    <dt><Hint text={CALCULATED_HELP.walkingStaminaUsage}>Walking stamina use</Hint></dt><dd>{row[A.walkingStaminaUsage]!.toFixed(4)}/tick</dd>
                    <dt><Hint text={CALCULATED_HELP.elderlyAge}>Elderly at</Hint></dt><dd>{row[A.elderlyAge]!.toFixed(2)} days{row[A.age]! >= row[A.elderlyAge]! ? ' (elderly)' : ''}</dd>
                    <dt><Hint text={CALCULATED_HELP.intelligence}>Intelligence</Hint></dt><dd>{(row[A.intelligence] ?? -1) >= 0 ? `${row[A.intelligence]} connections` : 'instinct (no network)'}</dd>
                </dl>
                {brain && (
                    <>
                        <h3 className="inspector__subhead"><Hint text={CALCULATED_HELP.network}>Neural network</Hint></h3>
                        <NeuralNetView brain={brain} />
                    </>
                )}
                <h3 className="inspector__subhead"><Hint text="The species' traits. Hover one to see what it does; they are chosen in Settings and never change during a run.">Traits</Hint></h3>
                <TraitChips traits={species.traits} />
            </>
        );
    }

    return (
        <section className="panel" aria-labelledby="inspector-h">
            <h2 id="inspector-h" className="panel__header">{selectedId === null ? 'Leaderboard' : 'Individual Inspector'}</h2>
            <div className="panel__body inspector">
                {selectedId === null ? <Leaderboard settings={leaderboardSettings} onSettingsChange={onLeaderboardSettingsChange} snapshot={snapshot} info={info} onSelect={onSelect} /> : body}
            </div>
        </section>
    );
}
