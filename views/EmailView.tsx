import React, { useState } from 'react';
import { Mail, FileText } from 'lucide-react';
import type { User } from '../types';
import { EmailTemplatesView } from './EmailTemplatesView';
import { EmailReportsView } from './EmailReportsView';

export type EmailSubTab = 'templates' | 'reports';

export interface EmailViewProps {
  user: User;
}

export const EmailView: React.FC<EmailViewProps> = ({ user }) => {
  const [subTab, setSubTab] = useState<EmailSubTab>('templates');
  const isDirector = user.role === 'Director';

  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-6 pt-6 pb-2 border-b border-slate-200 bg-white/80">
        <h2 className="text-2xl font-semibold text-slate-900 tracking-tight mb-4">
          Email
        </h2>
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setSubTab('templates')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              subTab === 'templates'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail size={18} />
            Templates
          </button>
          {isDirector && (
            <button
              type="button"
              onClick={() => setSubTab('reports')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                subTab === 'reports'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText size={18} />
              Reports
            </button>
          )}
        </div>
      </div>

      <div className="flex-1">
        {subTab === 'templates' && <EmailTemplatesView />}
        {subTab === 'reports' && isDirector && <EmailReportsView />}
      </div>
    </div>
  );
};
