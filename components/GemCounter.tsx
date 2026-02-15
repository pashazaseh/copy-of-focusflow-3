import React, { useEffect, useState, useRef } from 'react';
import { animate } from 'framer-motion';

interface GemCounterProps {
    value: number;
    className?: string;
}

export const GemCounter: React.FC<GemCounterProps> = ({ value, className = '' }) => {
    const [displayValue, setDisplayValue] = useState(value);
    const [flashState, setFlashState] = useState<'idle' | 'up' | 'down'>('idle');
    const prevValue = useRef(value);

    useEffect(() => {
        if (value === prevValue.current) return;

        const from = prevValue.current;
        const to = value;
        
        setFlashState(to > from ? 'up' : 'down');

        const controls = animate(from, to, {
            duration: 1.0,
            ease: "circOut",
            onUpdate: (latest) => {
                setDisplayValue(Math.round(latest));
            },
            onComplete: () => {
                setFlashState('idle');
            }
        });

        prevValue.current = value;

        return () => controls.stop();
    }, [value]);

    let flashClass = '';
    if (flashState === 'up') flashClass = 'text-green-500 dark:text-green-400 scale-110';
    if (flashState === 'down') flashClass = 'text-red-500 dark:text-red-400 scale-110';

    return (
        <span className={`${className} inline-flex tabular-nums`}>
            <span className={`transition-all duration-300 ${flashClass}`}>
                {displayValue}
            </span>
        </span>
    );
};