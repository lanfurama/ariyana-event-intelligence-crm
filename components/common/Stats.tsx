import React, { useMemo } from 'react';
import { EmailLog } from '../../types';

export const EmailActivityChart = ({ emailLogs }: { emailLogs: EmailLog[] }) => {
    const dailyActivity = useMemo(() => {
        const now = new Date();
        const days = [];
        const activityMap = new Map<string, number>();

        // Initialize last 7 days
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNumber = date.getDate();
            days.push({ dateKey, label: `${dayName} ${dayNumber}`, count: 0 });
            activityMap.set(dateKey, 0);
        }

        // Count emails per day
        emailLogs.forEach(log => {
            if (log.status === 'sent' && log.date) {
                const logDate = new Date(log.date);
                const dateKey = logDate.toISOString().split('T')[0];
                const existing = activityMap.get(dateKey) || 0;
                activityMap.set(dateKey, existing + 1);
            }
        });

        // Update days with counts
        return days.map(day => ({
            ...day,
            count: activityMap.get(day.dateKey) || 0
        }));
    }, [emailLogs]);

    const max = Math.max(...dailyActivity.map(d => d.count)) || 1;

    return (
        <div className="space-y-3">
            {dailyActivity.map((d) => {
                const pct = max > 0 ? Math.round((d.count / max) * 100) : 0;
                return (
                    <div key={d.dateKey} className="grid grid-cols-[80px_1fr_44px] items-center gap-3">
                        <div className="text-xs font-medium text-slate-700">{d.label}</div>
                        <div className="h-2.5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                            <div
                                className="h-full bg-slate-900 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        <div className="text-xs font-semibold text-slate-900 text-right tabular-nums">{d.count}</div>
                    </div>
                );
            })}
        </div>
    );
};

export const PipelineBars = ({ data, compact }: { data: { name: string, count: number }[]; compact?: boolean }) => {
    const max = Math.max(...data.map(d => d.count)) || 1;

    const colors = [
        { bg: 'bg-purple-500', dot: 'bg-purple-500' },
        { bg: 'bg-pink-500', dot: 'bg-pink-500' },
        { bg: 'bg-indigo-500', dot: 'bg-indigo-500' },
        { bg: 'bg-blue-500', dot: 'bg-blue-500' },
        { bg: 'bg-cyan-500', dot: 'bg-cyan-500' },
        { bg: 'bg-teal-500', dot: 'bg-teal-500' },
        { bg: 'bg-emerald-500', dot: 'bg-emerald-500' },
    ];

    const space = compact ? 'space-y-1.5' : 'space-y-3';
    const barHeight = compact ? 'h-2' : 'h-3';
    const dotSize = compact ? 'h-1.5 w-1.5' : 'h-2.5 w-2.5';
    const textSize = compact ? 'text-xs' : 'text-sm';
    const marginBar = compact ? 'mb-1' : 'mb-1.5';

    return (
        <div className={space}>
            {data.map((d, index) => {
                const pct = Math.round((d.count / max) * 100);
                const color = colors[index % colors.length];

                return (
                    <div key={d.name}>
                        <div className={`flex items-center justify-between ${marginBar}`}>
                            <div className="flex items-center gap-1.5">
                                <div className={`${dotSize} rounded-full ${color.dot}`}></div>
                                <div className={`${textSize} font-medium text-slate-700`}>{d.name}</div>
                            </div>
                            <div className={`${textSize} font-semibold text-slate-900 tabular-nums`}>{d.count}</div>
                        </div>
                        <div className={`${barHeight} rounded-full bg-slate-100 border border-slate-200 overflow-hidden`}>
                            <div
                                className={`h-full ${color.bg} rounded-full transition-all duration-500 ease-out`}
                                style={{ width: `${pct}%` }}
                                aria-label={`${d.name} ${d.count}`}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export const CountryPieChart = ({ data }: { data: { name: string, count: number }[] }) => {
    const total = data.reduce((sum, item) => sum + item.count, 0);
    const colors = [
        '#8b5cf6', // purple
        '#ec4899', // pink
        '#6366f1', // indigo
        '#3b82f6', // blue
        '#06b6d4', // cyan
        '#14b8a6', // teal
        '#10b981', // emerald
        '#f59e0b', // amber
        '#ef4444', // red
        '#84cc16', // lime
        '#06b6d4', // sky
        '#a855f7', // violet
    ];

    let currentAngle = -90; // Start from top
    const radius = 80;
    const centerX = 100;
    const centerY = 100;
    const strokeWidth = 2;

    const segments = data.map((item, index) => {
        const percentage = (item.count / total) * 100;
        const angle = (item.count / total) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle = endAngle;

        // Calculate path for pie slice
        const startAngleRad = (startAngle * Math.PI) / 180;
        const endAngleRad = (endAngle * Math.PI) / 180;
        
        const x1 = centerX + radius * Math.cos(startAngleRad);
        const y1 = centerY + radius * Math.sin(startAngleRad);
        const x2 = centerX + radius * Math.cos(endAngleRad);
        const y2 = centerY + radius * Math.sin(endAngleRad);
        
        const largeArcFlag = angle > 180 ? 1 : 0;
        
        const pathData = [
            `M ${centerX} ${centerY}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
            'Z'
        ].join(' ');

        return {
            ...item,
            pathData,
            color: colors[index % colors.length],
            percentage: percentage.toFixed(1),
            startAngle,
            endAngle,
            midAngle: (startAngle + endAngle) / 2,
        };
    });

    return (
        <div className="flex flex-col md:flex-row items-center gap-6">
            {/* SVG Pie Chart */}
            <div className="flex-shrink-0">
                <svg width="200" height="200" viewBox="0 0 200 200" className="drop-shadow-sm">
                    {segments.map((segment, index) => (
                        <g key={segment.name}>
                            <path
                                d={segment.pathData}
                                fill={segment.color}
                                stroke="white"
                                strokeWidth={strokeWidth}
                                className="hover:opacity-80 transition-opacity cursor-pointer"
                            />
                            {segment.percentage > 3 && (
                                <text
                                    x={centerX + (radius * 0.6) * Math.cos((segment.midAngle * Math.PI) / 180)}
                                    y={centerY + (radius * 0.6) * Math.sin((segment.midAngle * Math.PI) / 180)}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    className="text-xs font-semibold fill-white pointer-events-none"
                                    style={{ fontSize: '10px' }}
                                >
                                    {segment.percentage}%
                                </text>
                            )}
                        </g>
                    ))}
                </svg>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-2 max-h-[300px] overflow-y-auto">
                {segments.map((segment, index) => (
                    <div key={segment.name} className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: segment.color }}
                            />
                            <span className="font-medium text-slate-700 truncate" title={segment.name}>
                                {segment.name}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-slate-600 tabular-nums">{segment.count}</span>
                            <span className="text-xs text-slate-400 w-12 text-right">({segment.percentage}%)</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const StatCard = ({
    title,
    value,
    icon,
    subtitle,
    color = 'slate',
}: {
    title: string;
    value: number | string;
    icon: React.ReactNode;
    subtitle?: string;
    color?: 'blue' | 'green' | 'orange' | 'purple' | 'indigo' | 'cyan' | 'teal' | 'emerald' | 'slate';
}) => {
    const colorClasses = {
        blue: 'bg-blue-50 border-blue-200 text-blue-600',
        green: 'bg-green-50 border-green-200 text-green-600',
        orange: 'bg-orange-50 border-orange-200 text-orange-600',
        purple: 'bg-purple-50 border-purple-200 text-purple-600',
        indigo: 'bg-indigo-50 border-indigo-200 text-indigo-600',
        cyan: 'bg-cyan-50 border-cyan-200 text-cyan-600',
        teal: 'bg-teal-50 border-teal-200 text-teal-600',
        emerald: 'bg-emerald-50 border-emerald-200 text-emerald-600',
        slate: 'bg-slate-100 border-slate-200 text-slate-700',
    };

    return (
        <div className="glass-card p-3 rounded-lg">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">{title}</p>
                    <p className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">{value}</p>
                    {subtitle && (
                        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
                    )}
                </div>
                <div className={`h-10 w-10 rounded-lg ${colorClasses[color]} flex items-center justify-center flex-shrink-0`}>
                    {icon}
                </div>
            </div>
        </div>
    );
};
