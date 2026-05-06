import type React from 'react';
import type { DataIssue } from '../../../api/src/utils/dataQuality';

interface DataQualityIssuesProps {
  issues?: DataIssue[];
}

export const DataQualityIssues: React.FC<DataQualityIssuesProps> = ({ issues }) => {
  if (!issues || !Array.isArray(issues) || issues.length === 0) return null;

  const critical = issues.filter((i) => i.severity === 'critical');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');

  return (
    <div className="bg-slate-50 rounded border border-slate-200 px-4 py-3">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">Vấn đề về chất lượng dữ liệu</h3>
      <div className="space-y-2">
        {critical.length > 0 && (
          <div>
            <div className="text-xs font-medium text-red-700 mb-1">Quan trọng:</div>
            {critical.map((issue, idx) => (
              <div key={idx} className="text-sm text-red-700 mb-1 pl-3">
                • {issue.message}
              </div>
            ))}
          </div>
        )}
        {warnings.length > 0 && (
          <div>
            <div className="text-xs font-medium text-amber-700 mb-1">Cảnh báo:</div>
            {warnings.map((issue, idx) => (
              <div key={idx} className="text-sm text-amber-700 mb-1 pl-3">
                • {issue.message}
              </div>
            ))}
          </div>
        )}
        {infos.length > 0 && (
          <div>
            <div className="text-xs font-medium text-slate-600 mb-1">Thông tin:</div>
            {infos.map((issue, idx) => (
              <div key={idx} className="text-sm text-slate-600 mb-1 pl-3">
                • {issue.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
