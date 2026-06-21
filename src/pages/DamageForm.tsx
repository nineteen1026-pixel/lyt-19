import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Borrow, Tool } from '@shared/types';
import { ArrowLeft, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DamageForm() {
  const navigate = useNavigate();
  const [tools, setTools] = useState<Tool[]>([]);
  const [borrows, setBorrows] = useState<Borrow[]>([]);
  const [form, setForm] = useState({
    borrowId: 0,
    toolId: 0,
    description: '',
    severity: 'minor' as 'minor' | 'moderate' | 'severe',
    compensationAmount: 0,
    reportedBy: '管理员',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.tools.list().then(setTools);
    api.borrows.list().then(setBorrows);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.toolId) {
      alert('请选择工具');
      return;
    }
    if (!form.description.trim()) {
      alert('请填写损耗描述');
      return;
    }
    setSaving(true);
    try {
      await api.damages.create(form);
      navigate('/damages');
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate('/damages')} className="btn btn-secondary mb-5">
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        返回列表
      </button>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">登记工具损耗</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">关联借用记录</label>
              <select
                className="input"
                value={form.borrowId}
                onChange={e => {
                  const id = Number(e.target.value);
                  const borrow = borrows.find(b => b.id === id);
                  setForm({
                    ...form,
                    borrowId: id,
                    toolId: borrow?.toolId || form.toolId,
                  });
                }}
              >
                <option value={0}>-- 无（可选）</option>
                {borrows.map(b => (
                  <option key={b.id} value={b.id}>
                    #{b.id} - {b.toolName} - {b.borrowerName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">工具 *</label>
              <select
                className="input"
                value={form.toolId}
                onChange={e => setForm({ ...form, toolId: Number(e.target.value) })}
              >
                <option value={0}>-- 请选择工具 --</option>
                {tools.map(t => (
                  <option key={t.id} value={t.id}>{t.image} {t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">损坏程度</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'minor', label: '轻微', desc: '不影响使用', color: 'green' },
                { key: 'moderate', label: '一般', desc: '部分功能受影响', color: 'amber' },
                { key: 'severe', label: '严重', desc: '无法使用或损坏', color: 'red' },
              ].map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setForm({ ...form, severity: opt.key as typeof form.severity })}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    form.severity === opt.key
                      ? opt.color === 'green'
                        ? 'border-green-500 bg-green-50'
                        : opt.color === 'amber'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-red-500 bg-red-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">损耗描述 *</label>
            <textarea
              className="input min-h-[100px] resize-y"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="请详细描述损坏情况，例如：工具哪个部位损坏、程度如何等"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">赔偿金额 (元)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.compensationAmount}
                onChange={e => setForm({ ...form, compensationAmount: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">登记人</label>
              <input
                type="text"
                className="input"
                value={form.reportedBy}
                onChange={e => setForm({ ...form, reportedBy: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button type="submit" disabled={saving} className="btn btn-accent">
              <Save className="w-4 h-4 mr-1.5" />
              {saving ? '提交中...' : '确认登记'}
            </button>
            <button type="button" onClick={() => navigate('/damages')} className="btn btn-secondary">
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
