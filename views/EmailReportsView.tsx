import React, { useState, useEffect } from 'react';
import {
  Mail,
  Plus,
  Edit2,
  Trash2,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  X,
  Save,
  Power,
} from 'lucide-react';
import { emailReportsApi, EmailReportsConfig, EmailReportsLog } from '../services/apiService';

// Common timezones
const TIMEZONES = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (GMT+7)' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (GMT+7)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (GMT+8)' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong (GMT+8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (GMT+9)' },
  { value: 'UTC', label: 'UTC (GMT+0)' },
  { value: 'America/New_York', label: 'America/New_York (GMT-5)' },
  { value: 'Europe/London', label: 'Europe/London (GMT+0)' },
];

export const EmailReportsView = () => {
  const [configs, setConfigs] = useState<EmailReportsConfig[]>([]);
  const [logs, setLogs] = useState<EmailReportsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<EmailReportsConfig | null>(null);
  const [formData, setFormData] = useState({
    recipient_email: '',
    recipient_name: '',
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    day_of_week: 1, // Monday
    day_of_month: 1,
    time_hour: 9,
    time_minute: 0,
    timezone: 'Asia/Ho_Chi_Minh',
    enabled: true,
    include_stats: true,
    include_new_leads: true,
    include_email_activity: true,
    include_top_leads: true,
    top_leads_count: 10,
  });
  const [sending, setSending] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await emailReportsApi.getAll();
      setConfigs(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error loading email report configs:', error);
      setError(error.message || 'Failed to load email report configurations');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (configId?: string) => {
    try {
      const data = await emailReportsApi.getLogs(configId, 50);
      setLogs(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error loading logs:', error);
      setLogs([]);
    }
  };

  const handleCreate = () => {
    setEditingConfig(null);
    setFormData({
      recipient_email: '',
      recipient_name: '',
      frequency: 'daily',
      day_of_week: 1,
      day_of_month: 1,
      time_hour: 9,
      time_minute: 0,
      timezone: 'Asia/Ho_Chi_Minh',
      enabled: true,
      include_stats: true,
      include_new_leads: true,
      include_email_activity: true,
      include_top_leads: true,
      top_leads_count: 10,
    });
    setShowModal(true);
  };

  const handleEdit = (config: EmailReportsConfig) => {
    setEditingConfig(config);
    setFormData({
      recipient_email: config.recipient_email,
      recipient_name: config.recipient_name || '',
      frequency: config.frequency,
      day_of_week: config.day_of_week || 1,
      day_of_month: config.day_of_month || 1,
      time_hour: config.time_hour,
      time_minute: config.time_minute,
      timezone: config.timezone,
      enabled: config.enabled,
      include_stats: config.include_stats,
      include_new_leads: config.include_new_leads,
      include_email_activity: config.include_email_activity,
      include_top_leads: config.include_top_leads,
      top_leads_count: config.top_leads_count,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    // Validation
    if (!formData.recipient_email || !formData.recipient_email.trim()) {
      alert('Vui lòng nhập email người nhận');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.recipient_email.trim())) {
      alert('Email không hợp lệ');
      return;
    }

    // Validate frequency-specific fields
    if (formData.frequency === 'weekly' && (formData.day_of_week < 0 || formData.day_of_week > 6)) {
      alert('Vui lòng chọn ngày trong tuần hợp lệ');
      return;
    }

    if (formData.frequency === 'monthly' && (formData.day_of_month < 1 || formData.day_of_month > 28)) {
      alert('Ngày trong tháng phải từ 1 đến 28');
      return;
    }

    // Validate time
    if (formData.time_hour < 0 || formData.time_hour > 23) {
      alert('Giờ phải từ 0 đến 23');
      return;
    }

    if (formData.time_minute < 0 || formData.time_minute > 59) {
      alert('Phút phải từ 0 đến 59');
      return;
    }

    // Validate at least one include option
    if (!formData.include_stats && !formData.include_new_leads && 
        !formData.include_email_activity && !formData.include_top_leads) {
      alert('Vui lòng chọn ít nhất một phần để bao gồm trong báo cáo');
      return;
    }

    setSaving(true);
    try {
      if (editingConfig) {
        await emailReportsApi.update(editingConfig.id, formData);
      } else {
        await emailReportsApi.create(formData);
      }
      await loadConfigs();
      setShowModal(false);
      setEditingConfig(null);
    } catch (error: any) {
      console.error('Error saving config:', error);
      alert(`Lỗi khi lưu: ${error.message || 'Lỗi không xác định'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa cấu hình này?')) return;

    try {
      await emailReportsApi.delete(id);
      await loadConfigs();
    } catch (error) {
      console.error('Error deleting config:', error);
      alert('Lỗi khi xóa cấu hình');
    }
  };

  const handleToggleEnabled = async (config: EmailReportsConfig) => {
    setToggling(config.id);
    try {
      await emailReportsApi.update(config.id, { enabled: !config.enabled });
      await loadConfigs();
    } catch (error: any) {
      console.error('Error toggling config:', error);
      alert(`Lỗi khi cập nhật: ${error.message || 'Lỗi không xác định'}`);
    } finally {
      setToggling(null);
    }
  };

  const handleSend = async (id: string) => {
    setSending(id);
    try {
      const result = await emailReportsApi.send(id);
      if (result.success) {
        alert('Báo cáo đã được gửi thành công!');
        await loadConfigs();
        // Reload logs if they're currently shown
        if (showLogs === id) {
          await loadLogs(id);
        }
      } else {
        alert('Gửi báo cáo thất bại');
      }
    } catch (error: any) {
      console.error('Error sending report:', error);
      alert(`Lỗi khi gửi: ${error.message || 'Lỗi không xác định'}`);
    } finally {
      setSending(null);
    }
  };

  const handleToggleLogs = async (configId: string) => {
    if (showLogs === configId) {
      setShowLogs(null);
    } else {
      setShowLogs(configId);
      await loadLogs(configId);
    }
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'daily': return 'Hàng Ngày';
      case 'weekly': return 'Hàng Tuần';
      case 'monthly': return 'Hàng Tháng';
      default: return freq;
    }
  };

  const getDayOfWeekLabel = (day: number) => {
    const days = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return days[day] || `Day ${day}`;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
        <span className="ml-3 text-slate-600">Loading configurations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">Error Loading Configurations</h3>
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={loadConfigs}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen flex flex-col space-y-5">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Cấu hình Email Reports</h2>
          <p className="text-sm text-slate-600 mt-1">Quản lý cấu hình tự động gửi báo cáo email cho manager</p>
        </div>
        <button
          onClick={handleCreate}
          className="bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shrink-0 inline-flex items-center"
        >
          <Plus size={18} className="mr-2" /> Tạo cấu hình mới
        </button>
      </div>

      {configs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <Mail className="text-slate-300 mx-auto mb-3" size={48} />
          <p className="text-slate-700 font-medium">Chưa có cấu hình email reports</p>
          <p className="text-slate-500 text-sm mt-1">Tạo cấu hình đầu tiên để bắt đầu nhận báo cáo tự động</p>
          <button
            onClick={handleCreate}
            className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center hover:bg-indigo-700"
          >
            <Plus size={16} className="mr-2" /> Tạo cấu hình
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {configs.map((config) => (
            <div key={config.id} className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-slate-900">{config.recipient_name || config.recipient_email}</h3>
                    {config.enabled ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold flex items-center">
                        <CheckCircle size={12} className="mr-1" /> Enabled
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-semibold flex items-center">
                        <XCircle size={12} className="mr-1" /> Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mb-3">{config.recipient_email}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Frequency:</span>
                      <p className="font-semibold text-slate-900">{getFrequencyLabel(config.frequency)}</p>
                    </div>
                    {config.frequency === 'weekly' && (
                      <div>
                        <span className="text-slate-500">Day:</span>
                        <p className="font-semibold text-slate-900">{getDayOfWeekLabel(config.day_of_week || 0)}</p>
                      </div>
                    )}
                    {config.frequency === 'monthly' && (
                      <div>
                        <span className="text-slate-500">Day of Month:</span>
                        <p className="font-semibold text-slate-900">{config.day_of_month}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500">Time:</span>
                      <p className="font-semibold text-slate-900">
                        {String(config.time_hour).padStart(2, '0')}:{String(config.time_minute).padStart(2, '0')}
                      </p>
                    </div>
                    {config.last_sent_at && (
                      <div>
                        <span className="text-slate-500">Last Sent:</span>
                        <p className="font-semibold text-slate-900">
                          {config.last_sent_at ? new Date(config.last_sent_at).toLocaleDateString('vi-VN') : 'Never'}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {config.include_stats && (
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">Stats</span>
                    )}
                    {config.include_new_leads && (
                      <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-medium">New Leads</span>
                    )}
                    {config.include_email_activity && (
                      <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs font-medium">Email Activity</span>
                    )}
                    {config.include_top_leads && (
                      <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs font-medium">
                        Top {config.top_leads_count} Leads
                      </span>
                    )}
                  </div>
                </div>

                  <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleToggleEnabled(config)}
                    disabled={toggling === config.id}
                    className={`p-2 rounded-lg disabled:opacity-50 ${
                      config.enabled 
                        ? 'bg-green-50 text-green-600 hover:bg-green-100' 
                        : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                    title={config.enabled ? 'Tắt cấu hình' : 'Bật cấu hình'}
                  >
                    {toggling === config.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Power size={18} />
                    )}
                  </button>
                  <button
                    onClick={() => handleSend(config.id)}
                    disabled={sending === config.id || !config.enabled}
                    className="p-2 bg-indigo-50 text-indigo-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Gửi báo cáo ngay"
                  >
                    {sending === config.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Send size={18} />
                    )}
                  </button>
                  <button
                    onClick={() => handleToggleLogs(config.id)}
                    className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100"
                    title="Xem logs"
                  >
                    <Clock size={18} />
                  </button>
                  <button
                    onClick={() => handleEdit(config)}
                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                    title="Chỉnh sửa"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(config.id)}
                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                    title="Xóa"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {showLogs === config.id && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-900">Lịch sử gửi báo cáo</h4>
                    <button
                      onClick={() => loadLogs(config.id)}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Làm mới
                    </button>
                  </div>
                  {!logs || logs.filter(log => log.config_id === config.id).length === 0 ? (
                    <div className="text-center py-6">
                      <Clock className="text-slate-300 mx-auto mb-2" size={24} />
                      <p className="text-sm text-slate-500">Chưa có logs</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {logs
                        .filter(log => log && log.config_id === config.id)
                        .slice(0, 20)
                        .map((log) => (
                          <div key={log.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg text-sm border border-slate-200">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {log.status === 'sent' ? (
                                  <CheckCircle size={16} className="text-green-600" />
                                ) : (
                                  <XCircle size={16} className="text-red-600" />
                                )}
                                <span className="font-semibold text-slate-900">
                                  {log.sent_at ? new Date(log.sent_at).toLocaleString('vi-VN', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) : 'N/A'}
                                </span>
                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                                  {log.report_type === 'daily' ? 'Hàng ngày' : 
                                   log.report_type === 'weekly' ? 'Hàng tuần' : 
                                   log.report_type === 'monthly' ? 'Hàng tháng' : 'N/A'}
                                </span>
                              </div>
                              {log.period_start && log.period_end && (
                                <p className="text-xs text-slate-500 ml-6 mb-1">
                                  Kỳ: {new Date(log.period_start).toLocaleDateString('vi-VN')} - {new Date(log.period_end).toLocaleDateString('vi-VN')}
                                </p>
                              )}
                              {log.error_message && (
                                <p className="text-xs text-red-600 ml-6 mt-1 bg-red-50 p-2 rounded">
                                  <strong>Lỗi:</strong> {log.error_message}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingConfig ? 'Chỉnh sửa cấu hình' : 'Tạo cấu hình mới'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingConfig(null);
                }}
                className="text-slate-400 p-2 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email người nhận <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.recipient_email}
                  onChange={(e) => setFormData({ ...formData, recipient_email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="manager@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Tên người nhận
                </label>
                <input
                  type="text"
                  value={formData.recipient_name}
                  onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Tên Manager (tùy chọn)"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Tần suất <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="daily">Hàng Ngày</option>
                  <option value="weekly">Hàng Tuần</option>
                  <option value="monthly">Hàng Tháng</option>
                </select>
              </div>

              {formData.frequency === 'weekly' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Ngày trong tuần <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.day_of_week}
                    onChange={(e) => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="0">Chủ Nhật</option>
                    <option value="1">Thứ 2</option>
                    <option value="2">Thứ 3</option>
                    <option value="3">Thứ 4</option>
                    <option value="4">Thứ 5</option>
                    <option value="5">Thứ 6</option>
                    <option value="6">Thứ 7</option>
                  </select>
                </div>
              )}

              {formData.frequency === 'monthly' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Ngày trong tháng <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={formData.day_of_month}
                    onChange={(e) => setFormData({ ...formData, day_of_month: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Chọn ngày từ 1 đến 28</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Giờ (0-23) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={formData.time_hour}
                    onChange={(e) => setFormData({ ...formData, time_hour: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Phút (0-59) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.time_minute}
                    onChange={(e) => setFormData({ ...formData, time_minute: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Múi giờ <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Nội dung báo cáo <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <label className="flex items-center cursor-pointer hover:bg-white p-2 rounded">
                    <input
                      type="checkbox"
                      checked={formData.include_stats}
                      onChange={(e) => setFormData({ ...formData, include_stats: e.target.checked })}
                      className="mr-2 w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700">Thống kê tổng quan</span>
                  </label>
                  <label className="flex items-center cursor-pointer hover:bg-white p-2 rounded">
                    <input
                      type="checkbox"
                      checked={formData.include_new_leads}
                      onChange={(e) => setFormData({ ...formData, include_new_leads: e.target.checked })}
                      className="mr-2 w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700">Tóm tắt Leads mới</span>
                  </label>
                  <label className="flex items-center cursor-pointer hover:bg-white p-2 rounded">
                    <input
                      type="checkbox"
                      checked={formData.include_email_activity}
                      onChange={(e) => setFormData({ ...formData, include_email_activity: e.target.checked })}
                      className="mr-2 w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700">Hoạt động Email</span>
                  </label>
                  <label className="flex items-center cursor-pointer hover:bg-white p-2 rounded">
                    <input
                      type="checkbox"
                      checked={formData.include_top_leads}
                      onChange={(e) => setFormData({ ...formData, include_top_leads: e.target.checked })}
                      className="mr-2 w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700">Top Leads</span>
                  </label>
                </div>
              </div>

              {formData.include_top_leads && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Số lượng Top Leads
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.top_leads_count}
                    onChange={(e) => setFormData({ ...formData, top_leads_count: parseInt(e.target.value) || 10 })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Từ 1 đến 50 leads</p>
                </div>
              )}

              <div>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="mr-2 w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-semibold text-slate-700">Kích hoạt cấu hình này</span>
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingConfig(null);
                }}
                disabled={saving}
                className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-2" />
                    {editingConfig ? 'Cập nhật' : 'Tạo mới'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
