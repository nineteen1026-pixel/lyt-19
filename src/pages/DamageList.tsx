import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Damage, Borrow, Tool } from '@shared/types';
import { damageSeverityMap, formatDate, formatMoney } from '@/lib/format';
import { Plus, ArrowLeft, AlertTriangle, Save } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function DamageList() {
  const [damages, setDamages] = useState<Damage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.damages.list().then(data => {
      setDamages(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">
          共 {damages.length} 条损耗记录
        </div>
        <Link to="/damages/new" className="btn btn-accent">
          <Plus className="w-4 h-4 mr-1.5" />
          登记损耗
        </Link>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-gray-500 py-10 text-center">加载中...</div>
        ) : damages.length === 0 ? (
          <div className="p-16 text-center text-gray-400">暂无损耗记录</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
            {damages.map(d => (
              <div key={d.id} className="border border-gray-200 rounded-xl p-5 hover:border-red-200 hover:bg-red-50/30 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">损耗记录 #{d.id}</div>
                      <div className="text-xs text-gray-500">{formatDate(d.createdAt)}</div>
                    </div>
                  </div>
                  <span className={`badge ${damageSeverityMap[d.severity].className}`}>
                    {damageSeverityMap[d.severity].label}
                  </span>
                </div>

                <p className="text-sm text-gray-700 mb-4 bg-gray-50 rounded-lg p-3">
                  {d.description}
                </p>

                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500">关联工具ID</div>
                    <div className="text-gray-900 font-medium">#{d.toolId}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">关联借用ID</div>
                    <div className="text-gray-900 font-medium">#{d.borrowId || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">赔偿金额</div>
                    <div className="text-red-600 font-semibold">{formatMoney(d.compensationAmount)}</div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                  登记人：{d.reportedBy}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
