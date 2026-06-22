import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Deposit } from '@shared/types';
import { depositStatusMap, formatDate, formatMoney } from '@/lib/format';
import { ArrowDownCircle, ArrowUpCircle, Smartphone, Wallet, CreditCard, RefreshCw } from 'lucide-react';

const channelMap: Record<string, { label: string; icon: any; color: string }> = {
  wechat: { label: '微信', icon: Smartphone, color: 'text-green-600 bg-green-50' },
  alipay: { label: '支付宝', icon: Wallet, color: 'text-blue-600 bg-blue-50' },
  balance: { label: '余额', icon: CreditCard, color: 'text-amber-600 bg-amber-50' },
};

export default function DepositList() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundLoading, setRefundLoading] = useState<Record<number, boolean>>({});

  const loadData = () => {
    setLoading(true);
    api.deposits.list().then(data => {
      setDeposits(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRetryRefund = async (d: Deposit) => {
    if (!window.confirm(`确定重试该笔退款吗？\n金额：${formatMoney(d.amount)}`)) return;
    setRefundLoading(prev => ({ ...prev, [d.id]: true }));
    try {
      await api.payments.mockProcessRefund({ refundDepositId: d.id });
      loadData();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setRefundLoading(prev => ({ ...prev, [d.id]: false }));
    }
  };

  const stats = {
    totalCollect: deposits.filter(d => d.type === 'collect').reduce((s, d) => s + d.amount, 0),
    totalRefund: deposits.filter(d => d.type === 'refund' && d.status === 'completed').reduce((s, d) => s + d.amount, 0),
    totalPendingRefund: deposits.filter(d => d.type === 'refund' && d.status === 'refunding').reduce((s, d) => s + d.amount, 0),
    totalDeduct: deposits.reduce((s, d) => s + (d.deductedAmount || 0), 0),
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">退款中</div>
              <div className="text-2xl font-bold text-indigo-700">{formatMoney(stats.totalPendingRefund)}</div>
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
                  <th className="px-5 py-3 font-medium">支付渠道</th>
                  <th className="px-5 py-3 font-medium">交易单号</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 font-medium">备注 / 时间</th>
                  <th className="px-5 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map(d => {
                  const ch = d.payChannel ? channelMap[d.payChannel] : null;
                  const ChIcon = ch?.icon;
                  return (
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
                        {ch ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${ch.color}`}>
                            {ChIcon && <ChIcon className="w-3 h-3" />}
                            {ch.label}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-xs text-gray-600 font-mono space-y-0.5 max-w-[180px]">
                          {d.transactionId && (
                            <div className="truncate" title={d.transactionId}>
                              <span className="text-gray-400">支付:</span> {d.transactionId}
                            </div>
                          )}
                          {d.refundTransactionId && (
                            <div className="truncate" title={d.refundTransactionId}>
                              <span className="text-gray-400">退款:</span> {d.refundTransactionId}
                            </div>
                          )}
                          {d.outTradeNo && !d.transactionId && (
                            <div className="truncate" title={d.outTradeNo}>
                              <span className="text-gray-400">单号:</span> {d.outTradeNo}
                            </div>
                          )}
                          {!d.transactionId && !d.refundTransactionId && !d.outTradeNo && (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`badge ${depositStatusMap[d.status].className}`}>
                          {depositStatusMap[d.status].label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 max-w-xs">
                        <div className="truncate mb-0.5" title={d.remark}>
                          {d.remark || '-'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {d.type === 'collect' && d.payTime ? `支付: ${formatDate(d.payTime)}` : ''}
                          {d.type === 'refund' && d.refundTime ? `退款到账: ${formatDate(d.refundTime)}` : ''}
                          {!d.payTime && !d.refundTime ? `创建: ${formatDate(d.createdAt)}` : ''}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          {d.status === 'refund_failed' && (
                            <button
                              onClick={() => handleRetryRefund(d)}
                              disabled={!!refundLoading[d.id]}
                              className="btn btn-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3 h-3 mr-0.5 ${refundLoading[d.id] ? 'animate-spin' : ''}`} />
                              重试退款
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
