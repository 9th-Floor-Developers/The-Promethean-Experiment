interface Props {
    onStart: () => void;
}

/**
 * Landing screen: project title plus a click-to-start prompt.
 * A full-screen button covers the screen so a click anywhere (or Enter/Space
 * via keyboard focus) starts the transition to the Opening screen.
 */
export function LandingScreen({ onStart }: Props) {
    return (
        <div className="landing">
            <h1 className="landing__title">The Prometheus Experiment</h1>
            <p className="landing__prompt" aria-hidden="true">Click anywhere to start</p>
            <button
                type="button"
                className="landing__hit"
                onClick={onStart}
                aria-label="The Prometheus Experiment. Click anywhere to start"
                autoFocus
            />
        </div>
    );
}
