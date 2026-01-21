import React from 'react';
import { Skeleton } from './Skeleton';

export const LeadsSkeleton: React.FC = () => {
    return (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 space-y-3 pr-1 pb-2">
            {[...Array(6)].map((_, i) => (
                <div key={i} className="group relative glass-card p-5 rounded-2xl border border-white/20 shadow-sm">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        {/* Company Section Skeleton */}
                        <div className="flex-1 w-full md:w-[30%] flex items-start gap-4">
                            <Skeleton variant="rectangular" width={56} height={56} className="rounded-2xl shrink-0" />
                            <div className="min-w-0 flex-1 space-y-2">
                                <Skeleton variant="text" width="80%" height={20} />
                                <div className="flex gap-2">
                                    <Skeleton variant="text" width="40%" height={16} />
                                    <Skeleton variant="text" width="30%" height={16} />
                                </div>
                                <Skeleton variant="text" width="20%" height={12} className="mt-1" />
                            </div>
                        </div>

                        {/* Key Person Section Skeleton */}
                        <div className="flex-1 w-full md:w-[25%] border-l border-slate-100 pl-6 border-dashed">
                            <div className="flex items-center gap-3">
                                <Skeleton variant="circular" width={40} height={40} className="shrink-0" />
                                <div className="min-w-0 flex-1 space-y-1.5">
                                    <Skeleton variant="text" width="70%" height={16} />
                                    <Skeleton variant="text" width="50%" height={12} />
                                </div>
                            </div>
                        </div>

                        {/* Metrics Section Skeleton */}
                        <div className="flex-1 w-full md:w-[20%] flex items-center justify-center border-l border-slate-100 px-4 border-dashed">
                            <div className="flex flex-col items-center gap-2 w-full">
                                <div className="flex justify-between w-full">
                                    <Skeleton variant="text" width={40} height={12} />
                                    <Skeleton variant="text" width={20} height={12} />
                                </div>
                                <Skeleton variant="rectangular" width="100%" height={6} className="rounded-full" />
                                <Skeleton variant="text" width={50} height={16} className="rounded-full" />
                            </div>
                        </div>

                        {/* Actions Section Skeleton */}
                        <div className="flex-1 w-full md:w-[25%] flex items-center justify-end gap-3 border-l border-slate-100 pl-6 border-dashed">
                            <div className="flex items-center gap-2 mr-2">
                                <Skeleton variant="rectangular" width={40} height={40} className="rounded-xl" />
                                <Skeleton variant="rectangular" width={40} height={40} className="rounded-xl" />
                            </div>
                            <Skeleton variant="rectangular" width={44} height={44} className="rounded-xl" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
