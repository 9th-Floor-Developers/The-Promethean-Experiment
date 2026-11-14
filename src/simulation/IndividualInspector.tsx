import { Leaderboard, type LeaderboardSettings } from './Leaderboard';
import { A, type SimInfo, type SimSnapshot } from '../sim/types';

interface Props {
    snapshot: SimSnapshot | null;
    info: SimInfo | null;
    selectedId: number | null;
    /** Selects an animal by id, or clears the selection with null. */
    onSelect: (id: number | null) => void;
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
            <span className="meter__value">{Math.round(value)}/{max}</span>
        </div>
    );
}

/** Shows the selected animal's status values (HP, stamina, nutrition, hydration, age), feelings and current action. */
export function IndividualInspector({ snapshot, info, selectedId, onSelect, following, onFollowChange, leaderboardSettings, onLeaderboardSettingsChange }: Props) {
    const row = selectedId === null ? undefined : snapshot?.animals.find((r) => r[A.id] === selectedId);
    const species = row && info ? info.species[row[A.species]!] : undefined;

    let body;
    if (selectedId === null) {
        body = null; // the leaderboard is shown instead, see below
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
                <Meter label="HP" value={row[A.hp]!} max={species.maxHp} tone="hp" />
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
