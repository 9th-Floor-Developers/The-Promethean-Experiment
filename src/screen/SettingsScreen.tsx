import { useEffect, useRef } from 'react';
import {
    CATEGORIES, EXTRA_TRAITS, MAX_COUNT, MAX_SPECIES, MIN_COUNT, STATS, carnivoreTemplate, defaultSettings, herbivoreTemplate,
    newSpeciesName, type SimSettings, type SpeciesSettings, type StatKey,
} from '../settings/speciesSettings';

interface Props {
    settings: SimSettings;
    onChange: (next: SimSettings) => void;
    onDone: () => void;
}

/** Formats a stat for display next to its slider. */
function formatStat(v: number, step: number): string {
    return step >= 1 ? String(v) : v.toFixed(step < 0.01 ? 3 : 2);
}

/**
 * Settings screen: choose which species run in the simulation, how many of each, and their stats and traits.
 * Every control has a plain-language label and help text. Changes apply the next time the simulation starts;
 * Done (or Escape) returns to the main menu.
 */
export function SettingsScreen({ settings, onChange, onDone }: Props) {
    const doneRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        doneRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !(e.target instanceof HTMLSelectElement)) onDone();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onDone]);

    const update = (uid: number, patch: (s: SpeciesSettings) => SpeciesSettings) =>
        onChange({ species: settings.species.map((s) => (s.uid === uid ? patch(s) : s)) });
    const add = (make: () => SpeciesSettings) => {
        const s = make();
        onChange({ species: [...settings.species, { ...s, name: newSpeciesName(settings.species) }] });
    };
    const canAdd = settings.species.length < MAX_SPECIES;

    return (
        <section className="settings" aria-labelledby="settings-heading">
            <header className="settings__top">
                <div>
                    <h1 id="settings-heading" className="settings__heading">Settings</h1>
                    <p className="settings__intro">Design the animals that will live on the island. Changes are used the next time you press Start Simulation.</p>
                </div>
                <div className="settings__actions">
                    <button type="button" className="btn" onClick={() => onChange(defaultSettings())}>Reset to default</button>
                    <button ref={doneRef} type="button" className="btn btn--primary" onClick={onDone}>Done</button>
                </div>
            </header>

            <div className="settings__list">
                {settings.species.map((sp, index) => (
                    <SpeciesCard key={sp.uid} sp={sp} index={index} canRemove={settings.species.length > 1}
                        onPatch={(p) => update(sp.uid, p)}
                        onRemove={() => onChange({ species: settings.species.filter((s) => s.uid !== sp.uid) })} />
                ))}
            </div>

            <div className="settings__add">
                <button type="button" className="btn" disabled={!canAdd} onClick={() => add(herbivoreTemplate)}>+ Add a plant eater</button>
                <button type="button" className="btn" disabled={!canAdd} onClick={() => add(carnivoreTemplate)}>+ Add a meat eater</button>
                {!canAdd && <span className="settings__hint">You can have up to {MAX_SPECIES} species.</span>}
            </div>
            <p className="settings__hint">
                Diet, daily schedule and self-healing change how animals behave right now; the other traits are recorded for future updates.
            </p>
        </section>
    );
}

interface CardProps {
    sp: SpeciesSettings;
    index: number;
    canRemove: boolean;
    onPatch: (patch: (s: SpeciesSettings) => SpeciesSettings) => void;
    onRemove: () => void;
}

/** One species: name, starting population, stat sliders, trait dropdowns and optional-trait toggles. */
function SpeciesCard({ sp, index, canRemove, onPatch, onRemove }: CardProps) {
    const id = `sp${sp.uid}`;
    const setTrait = (categoryKey: string, traitId: string) => {
        const category = CATEGORIES.find((c) => c.key === categoryKey)!;
        const ids = new Set(category.options.map((o) => o.id));
        onPatch((s) => ({ ...s, traits: [...s.traits.filter((t) => !ids.has(t)), traitId] }));
    };
    const toggleExtra = (traitId: string) =>
        onPatch((s) => ({ ...s, traits: s.traits.includes(traitId) ? s.traits.filter((t) => t !== traitId) : [...s.traits, traitId] }));

    return (
        <article className="species-card" aria-label={sp.name}>
            <header className="species-card__head">
                <span className="species-card__badge">{index + 1}</span>
                <label className="field field--grow">
                    <span className="field__label">Species name</span>
                    <input className="input" value={sp.name} maxLength={24} onChange={(e) => onPatch((s) => ({ ...s, name: e.target.value }))} />
                </label>
                <label className="field">
                    <span className="field__label">Starting animals</span>
                    <input className="input input--num" type="number" min={MIN_COUNT} max={MAX_COUNT} value={sp.count}
                        onChange={(e) => onPatch((s) => ({ ...s, count: Math.max(MIN_COUNT, Math.min(MAX_COUNT, Number(e.target.value) || MIN_COUNT)) }))} />
                </label>
                {canRemove && <button type="button" className="btn species-card__remove" onClick={onRemove} aria-label={`Remove ${sp.name}`}>Remove</button>}
            </header>

            <h2 className="species-card__title">Body and abilities</h2>
            <div className="stats">
                {STATS.map((d) => (
                    <div key={d.key} className="stat">
                        <label htmlFor={`${id}-${d.key}`} className="stat__label">
                            {d.label} <strong>{formatStat(sp.stats[d.key], d.step)}{d.unit}</strong>
                        </label>
                        <input id={`${id}-${d.key}`} className="slider" type="range" min={d.min} max={d.max} step={d.step} value={sp.stats[d.key]}
                            onChange={(e) => onPatch((s) => ({ ...s, stats: { ...s.stats, [d.key as StatKey]: Number(e.target.value) } }))} />
                        <div className="stat__ends"><span>{d.low}</span><span>{d.high}</span></div>
                        <p className="stat__help">{d.help}</p>
                    </div>
                ))}
            </div>

            <h2 className="species-card__title">Traits</h2>
            <div className="traits">
                {CATEGORIES.map((c) => {
                    const current = c.options.find((o) => sp.traits.includes(o.id));
                    return (
                        <div key={c.key} className="trait">
                            <label htmlFor={`${id}-${c.key}`} className="trait__label">{c.label}</label>
                            <select id={`${id}-${c.key}`} className="input" value={current?.id ?? ''} onChange={(e) => setTrait(c.key, e.target.value)}>
                                {!current && <option value="" disabled>Choose…</option>}
                                {c.options.map((o) => <option key={o.id} value={o.id} disabled={o.unavailable}>{o.label}{o.unavailable ? ' (coming soon)' : ''}</option>)}
                            </select>
                            <p className="stat__help">{current?.help ?? c.question}</p>
                        </div>
                    );
                })}
            </div>

            <h2 className="species-card__title">Extra abilities <span className="settings__hint">(optional)</span></h2>
            <div className="chips">
                {EXTRA_TRAITS.map((t) => (
                    <button key={t.id} type="button" className={`chip${sp.traits.includes(t.id) ? ' chip--on' : ''}`} aria-pressed={sp.traits.includes(t.id)}
                        title={t.help} onClick={() => toggleExtra(t.id)}>
                        {t.label}
                    </button>
                ))}
            </div>
        </article>
    );
}
