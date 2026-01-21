import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner: React.FC = () => {
    return (
        <div className="flex h-full w-full items-center justify-center min-h-[50vh]">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-slate-600" size={32} />
                <span className="text-slate-600 text-sm font-medium">Loading...</span>
            </div>
        </div>
    );
};
