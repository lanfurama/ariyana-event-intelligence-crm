import type React from 'react';
import { useState } from 'react';
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

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-2 px-1 pb-3 -mb-px text-sm font-semibold border-b-2 transition-colors ${
      active
        ? 'border-brand-500 text-slate-900'
        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
    }`;

  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-6 pt-6 border-b border-slate-200 bg-white">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Email Studio</h1>
        <p className="text-sm text-slate-500 mt-1 mb-4">
          Templates, test sends & scheduled manager reports
        </p>
        <div className="flex gap-6">
          <button type="button" onClick={() => setSubTab('templates')} className={tabClass(subTab === 'templates')}>
            <Mail size={16} />
            Templates
          </button>
          {isDirector && (
            <button type="button" onClick={() => setSubTab('reports')} className={tabClass(subTab === 'reports')}>
              <FileText size={16} />
              Scheduled Reports
            </button>
          )}
        </div>
      </div>

      {subTab === 'templates' && <EmailTemplatesView />}
      {subTab === 'reports' && isDirector && <EmailReportsView />}
    </div>
  );
};
