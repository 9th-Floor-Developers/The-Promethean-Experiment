import { Leaderboard, type LeaderboardSettings } from './Leaderboard';
import { A, type ObjectInfo, type SimInfo, type SimSnapshot } from '../sim/types';

const TICKS_PER_DAY = 1200;

interface Props {
    snapshot: SimSnapshot | null;
    info: SimInfo | null;
    selectedId: number | null;
    /** Selects an animal by id, or clears the selection with null. */
    onSelect: (id: number | null) => void;
    /** Looks up the details of a selected tree, grass tuft, carcass or egg. */
    objectInfoOf: ((id: number) => ObjectInfo | null) | null;
    /** Whether the camera is locked onto the selected animal. */
    following: boolean;
    leaderboardSettings: LeaderboardSettings;
    onLeaderboardSettingsChange: (settings: LeaderboardSettings) => void;
    onFollowChange: (following: boolean) => void;
}

/** "RUN_FROM_PREDATOR" -> "Run from predator". */
function actionLabel(name: string): string {
    const text = name.toLowerCase().replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A labelled status bar: `value` out of `max`, drawn as a filled track with the number beside it. */
function Meter({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return (
        <div className="meter">
            <span className="meter__label">{label}</span>
            <div className="meter__track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}>
                <div className={`meter__fill meter__fill--${tone}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="meter__value">{Math.round(value)}/{Math.round(max)}</span>
        </div>
    );
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
                        <span className="meter__label">State</span>
                        <span className="inspector__action-value">{object.edible ? 'Ready to eat' : 'Regrowing'}</span>
                    </div>
                    <Meter label="Regrowth" value={object.cooldownTicks - object.cooldownRemaining} max={object.cooldownTicks} tone="stamina" />
                    <dl className="inspector__facts">
                        <dt>Cooldown left</dt><dd>{object.edible ? 'none' : formatTicks(object.cooldownRemaining)}</dd>
                        <dt>Full cooldown</dt><dd>{formatTicks(object.cooldownTicks)}</dd>
                        <dt>Nutrition</dt><dd>{object.nutrition}</dd>
                        <dt>Position</dt><dd>{object.x.toFixed(1)}, {object.y.toFixed(1)}</dd>
                    </dl>
                </>
            )}
            {object.type === 'CARCASS' && (
                <>
                    <Meter label="Meat left" value={object.nutrition} max={object.initialNutrition} tone="nutrition" />
                    <dl className="inspector__facts">
                        <dt>Rots away in</dt><dd>{formatTicks(object.rotTicksLeft)}</dd>
                        <dt>Nutrition</dt><dd>{object.nutrition.toFixed(1)} of {object.initialNutrition.toFixed(1)}</dd>
                        <dt>Position</dt><dd>{object.x.toFixed(1)}, {object.y.toFixed(1)}</dd>
                    </dl>
                </>
            )}
            {object.type === 'EGG' && (
                <>
                    <Meter label="Hatching" value={object.hatchTicks - object.ticksLeft} max={object.hatchTicks} tone="hp" />
                    <dl className="inspector__facts">
                        <dt>Species</dt><dd>{object.species}</dd>
                        <dt>Hatches in</dt><dd>{formatTicks(object.ticksLeft)}</dd>
                        <dt>Nutrition</dt><dd>{object.nutrition.toFixed(1)}</dd>
                        <dt>Position</dt><dd>{object.x.toFixed(1)}, {object.y.toFixed(1)}</dd>
                    </dl>
                </>
            )}
        </>
    );
}

/** Shows the selected animal's status values (HP, stamina, nutrition, hydration, age), feelings and current action. */
export function IndividualInspector({ snapshot, info, selectedId, onSelect, objectInfoOf, following, onFollowChange, leaderboardSettings, onLeaderboardSettingsChange }: Props) {
    const row = selectedId === null ? undefined : snapshot?.animals.find((r) => r[A.id] === selectedId);
    const species = row && info ? info.species[row[A.species]!] : undefined;

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
                    <span className="meter__label">Action</span>
                    <span className="inspector__action-value">{actionLabel(info.actions[row[A.action]!] ?? 'unknown')}</span>
                </div>
                <Meter label="HP" value={row[A.hp]!} max={row[A.maxHp]!} tone="hp" />
                <Meter label="Stamina" value={row[A.stamina]!} max={species.maxStamina} tone="stamina" />
                <Meter label="Nutrition" value={row[A.nutrition]!} max={species.maxNutrition} tone="nutrition" />
                <Meter label="Hydration" value={row[A.hydration]!} max={species.maxHydration} tone="hydration" />
                <dl className="inspector__facts">
                    <dt>Age</dt><dd>{row[A.age]!.toFixed(2)} days</dd>
                    <dt>Fear</dt><dd>{row[A.fear]!.toFixed(2)}</dd>
                    <dt>Hunger</dt><dd>{row[A.hunger]!.toFixed(2)}</dd>
                    <dt>Thirst</dt><dd>{row[A.thirst]!.toFixed(2)}</dd>
                    <dt>Libido</dt><dd>{row[A.libido]!.toFixed(2)}</dd>
                </dl>
                <h3 className="inspector__subhead">Inherited stats</h3>
                <dl className="inspector__facts">
                    <dt>Max HP</dt><dd>{row[A.maxHp]!.toFixed(1)}</dd>
                    <dt>Speed</dt><dd>{row[A.speed]!.toFixed(3)} tiles/tick</dd>
                    <dt>Damage</dt><dd>{row[A.damage]!.toFixed(2)}</dd>
                    <dt>Armor</dt><dd>{row[A.armor]!.toFixed(1)}%</dd>
                    <dt>View range</dt><dd>{row[A.viewRange]!.toFixed(1)} tiles</dd>
                </dl>
                <h3 className="inspector__subhead">Calculated stats</h3>
                <dl className="inspector__facts">
                    <dt>Base stamina use</dt><dd>{row[A.baseStaminaUsage]!.toFixed(4)}/tick</dd>
                    <dt>Walking stamina use</dt><dd>{row[A.walkingStaminaUsage]!.toFixed(4)}/tick</dd>
                    <dt>Elderly at</dt><dd>{row[A.elderlyAge]!.toFixed(2)} days{row[A.age]! >= row[A.elderlyAge]! ? ' (elderly)' : ''}</dd>
                </dl>
                <p className="inspector__traits">{species.traits.map((t) => t.toLowerCase().replace(/_/g, ' ')).join(' · ')}</p>
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
