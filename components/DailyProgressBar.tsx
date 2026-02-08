import React from 'react';

interface DailyProgressBarProps {
    progress: number;
}

export const DailyProgressBar: React.FC<DailyProgressBarProps> = ({ progress }) => {
    return (
        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 my-4">
            <div
                className="bg-gradient-to-r from-green-400 to-blue-500 h-2.5 rounded-full"
                style={{
                    width: `${progress}%`,
                    transition: 'width 0.5s ease-in-out'
                }}
            ></div>
        </div>
    );
};
