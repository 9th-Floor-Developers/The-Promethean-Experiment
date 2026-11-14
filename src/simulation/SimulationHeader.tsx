import { SimulationClock } from './SimulationClock';
import { SimulationSpeed } from './SimulationSpeed';
import type { SimSnapshot } from '../sim/types';

interface Props {
    snapshot: SimSnapshot | null;
    /** Stops the simulation, discards it and returns to the previous screen. */
    onBack: () => void;
    /** Whether the sidebar is currently shown, and a toggle for it. */
    sidebarOpen: boolean;
    onToggleSidebar: () => void;
    speed: number;
    onSpeedChange: (speed: number) => void;
}

/** Narrow top bar. Back button at the far left, then the clock at the upper-left with the speed adjustor beside it. */
export function SimulationHeader({ snapshot, speed, onSpeedChange, onBack, sidebarOpen, onToggleSidebar }: Props) {
    return (
        <header className="sim__header">
            <button type="button" className="sim__back" onClick={onBack}>← Back</button>
            <SimulationClock snapshot={snapshot} />
            <SimulationSpeed speed={speed} onChange={onSpeedChange} />
            <button type="button" className="sim__sidebar-toggle" onClick={onToggleSidebar}
                    aria-pressed={sidebarOpen} aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                    title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}>
                {/* Window with a right-hand panel; the arrow points the way the panel will move. */}
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="2.5" />
                    <path d="M15 4v16" />
                    <path d={sidebarOpen ? 'M10.5 9.5L13 12l-2.5 2.5' : 'M12.5 9.5L10 12l2.5 2.5'} transform="translate(2.5 0)" />
                </svg>
            </button>
        </header>
    );
}
