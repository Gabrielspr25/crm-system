import React from 'react';

const TargetIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 ${className}`}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 0 0-5.84-7.38v4.82m5.84 2.56-4.82-5.84m-2.56 5.84a14.98 14.98 0 0 1 7.38-5.84m-7.38 5.84-5.84-4.82m5.84 4.82v7.38a6 6 0 0 1-7.38-5.84m7.38 5.84-4.82 5.84M3.464 14.37a14.98 14.98 0 0 1 5.84-7.38m-5.84 7.38a14.98 14.98 0 0 0 7.38 5.84m-7.38-5.84H2.25m19.5 0h-1.21a14.98 14.98 0 0 1-5.84 7.38m5.84-7.38h1.21M14.37 3.464a14.98 14.98 0 0 0-5.84 7.38m5.84-7.38a14.98 14.98 0 0 1 7.38 5.84m-7.38-5.84v1.21m0 19.5v-1.21" />
    </svg>
);

export default TargetIcon;
