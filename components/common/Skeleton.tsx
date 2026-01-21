import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'rectangular' | 'circular' | 'text';
    width?: string | number;
    height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    variant = 'rectangular',
    width,
    height,
}) => {
    const baseClasses = 'animate-pulse bg-slate-200/50';
    const variantClasses = {
        rectangular: 'rounded-md',
        circular: 'rounded-full',
        text: 'rounded',
    };

    const style = {
        width: width,
        height: height,
    };

    return (
        <div
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
            style={style}
        />
    );
};
