import { useEffect, useRef } from 'react';

interface Props {
    onBack: () => void;
}

/**
 * Credits screen: a full screen of text over the persistent 3D world, with a single
 * Back button. Escape also goes back. Content is exactly what the project docs specify.
 */
export function CreditsScreen({ onBack }: Props) {
    const backRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        backRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onBack();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onBack]);

    return (
        <section
            className="credits"
            aria-labelledby="credits-heading"
            onKeyDown={(e) => e.repeat && e.preventDefault()}
        >
            <h1 id="credits-heading" className="credits__heading">Credits</h1>
            <ul className="credits__list">
                <li>Landen Ingerslev (Calcium King)</li>
                <li>Pete (Seal Ball Pete)</li>
            </ul>
            <p className="credits__note">Created for the 14th annual UMass Hackathon</p>
            <button ref={backRef} type="button" className="btn credits__back" onClick={onBack}>
                Back
            </button>
        </section>
    );
}
