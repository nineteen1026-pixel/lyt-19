import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Deposit } from '@shared/types';
import { depositStatusMap, formatDate, formatMoney } from '@/lib/format';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

export default function DepositList() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.deposits.list().then(data => {
      setDeposits(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const stats = {
    totalCollect: deposits.filter(d => d.type === 'collect').reduce((s, d) => s + d.amount, 0),
    totalRefund: deposits.filter(d => d.type === 'refund').reduce((s, d) => s + d.amount, 0),
    totalDeduct: deposits.reduce((s, d) => s + (d.deductedAmount || 0), 0),
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <ArrowDownCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">累计收取押金</div>
              <div className="text-2xl font-bold text-green-700">{formatMoney(stats.totalCollect)}</div>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <ArrowUpCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">累计退还押金</div>
              <div className="text-2xl font-bold text-blue-700">{formatMoney(stats.totalRefund)}</div>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <ArrowUpCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">损耗扣款合计</div>
              <div className="text-2xl font-bold text-red-700">{formatMoney(stats.totalDeduct)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-gray-500 py-10 text-center">加载中...</div>
        ) : deposits.length === 0 ? (
          <div className="p-16 text-center text-gray-400">暂无押金记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500">
                  <th className="px-5 py-3 font-medium">关联借用ID</th>
                  <th className="px-5 py-3 font-medium">类型</th>
                  <th className="px-5 py-3 font-medium">金额</th>
                  <th className="px-5 py-3 font-medium">扣款金额</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 font-medium">备注</th>
                  <th className="px-5 py-3 font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map(d => (
                  <tr key={d.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 text-gray-700">#{d.borrowId}</td>
                    <td className="px-5 py-3.5">
                      {d.type === 'collect' ? (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <ArrowDownCircle className="w-4 h-4" />收取
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-blue-700">
                          <ArrowUpCircle className="w-4 h-4" />退还
                        </span>
                      )}
                    </td>
                    <td className={`px-5 py-3.5 font-semibold ${d.type === 'collect' ? 'text-green-700' : 'text-blue-700'}`}>
                      {d.type === 'collect' ? '+' : '-'}{formatMoney(d.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-red-600 font-medium">
                      {d.deductedAmount > 0 ? formatMoney(d.deductedAmount) : '-'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`badge ${depositStatusMap[d.status].className}`}>
                        {depositStatusMap[d.status].label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 max-w-xs truncate" title={d.remark}>
                      {d.remark || '-'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{formatDate(d.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
