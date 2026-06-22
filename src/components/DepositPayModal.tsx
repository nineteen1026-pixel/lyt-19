import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Borrow, Deposit, PayChannel } from '@shared/types';
import { formatMoney, formatDate } from '@/lib/format';
import { X, QrCode, CheckCircle, Loader2, CreditCard, Wallet, Smartphone } from 'lucide-react';

interface DepositPayModalProps {
  open: boolean;
  onClose: () => void;
  borrow: Borrow;
  depositAmount: number;
  existingDepositId?: number;
  onPaySuccess?: (data: { deposit: Deposit; borrow: Borrow }) => void;
}

type PayStep = 'select' | 'paying' | 'success' | 'fail';

const channelOptions: { key: PayChannel; label: string; icon: any; color: string; desc: string }[] = [
  { key: 'wechat', label: '微信支付', icon: Smartphone, color: 'bg-green-50 border-green-200 text-green-700', desc: '推荐 99% 用户使用' },
  { key: 'alipay', label: '支付宝', icon: Wallet, color: 'bg-blue-50 border-blue-200 text-blue-700', desc: '支持花呗、余额宝' },
  { key: 'balance', label: '余额支付', icon: CreditCard, color: 'bg-amber-50 border-amber-200 text-amber-700', desc: '使用账户余额支付' },
];

export default function DepositPayModal({ open, onClose, borrow, depositAmount, existingDepositId, onPaySuccess }: DepositPayModalProps) {
  const [step, setStep] = useState<PayStep>('select');
  const [channel, setChannel] = useState<PayChannel>('wechat');
  const [depositId, setDepositId] = useState<number | undefined>(existingDepositId);
  const [outTradeNo, setOutTradeNo] = useState<string>('');
  const [paying, setPaying] = useState(false);
  const [polling, setPolling] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState<{ deposit: Deposit; borrow: Borrow } | null>(null);

  useEffect(() => {
    if (open) {
      setStep('select');
      setChannel('wechat');
      setDepositId(existingDepositId);
      setOutTradeNo('');
      setErrorMsg('');
      setSuccessData(null);
      setPaying(false);
    }
  }, [open, existingDepositId]);

  const handleStartPay = async () => {
    setPaying(true);
    setErrorMsg('');
    try {
      if (!depositId) {
        const result = await api.payments.createDepositOrder({ borrowId: borrow.id, payChannel: channel });
        setDepositId(result.deposit.id);
        setOutTradeNo(result.payInfo.outTradeNo);
      }
      setStep('paying');
      setTimeout(() => executeMockPay(), 800);
    } catch (e) {
      setErrorMsg((e as Error).message || '创建支付订单失败');
      setStep('fail');
    } finally {
      setPaying(false);
    }
  };

  const executeMockPay = async () => {
    if (!depositId) return;
    setPolling(true);
    try {
      const data = await api.payments.mockPayDeposit({ depositId, payChannel: channel });
      setSuccessData(data);
      setStep('success');
      onPaySuccess?.(data);
    } catch (e) {
      setErrorMsg((e as Error).message || '支付失败，请稍后重试');
      setStep('fail');
    } finally {
      setPolling(false);
    }
  };

  const handleRetry = () => {
    setStep('select');
    setErrorMsg('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">押金支付</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-5 p-4 rounded-xl bg-gradient-to-br from-primary-50 to-emerald-50 border border-primary-100">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-gray-500 mb-1">借用工具</div>
                <div className="font-semibold text-gray-900">{borrow.toolName}</div>
                <div className="mt-2 text-xs text-gray-500">
                  借用人：{borrow.borrowerName} · {borrow.borrowerRoom}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500 mb-1">支付金额</div>
                <div className="text-3xl font-bold text-primary-700">{formatMoney(depositAmount)}</div>
              </div>
            </div>
          </div>

          {step === 'select' && (
            <>
              <div className="mb-2 text-sm font-medium text-gray-700">选择支付方式</div>
              <div className="space-y-2 mb-6">
                {channelOptions.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setChannel(opt.key)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                        channel === opt.key
                          ? `${opt.color} border-current shadow-sm`
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${channel === opt.key ? 'bg-white/60' : 'bg-gray-50'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold">{opt.label}</div>
                        <div className={`text-xs ${channel === opt.key ? 'opacity-80' : 'text-gray-400'}`}>{opt.desc}</div>
                      </div>
                      {channel === opt.key && <CheckCircle className="w-5 h-5" />}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={handleStartPay}
                disabled={paying}
                className="w-full btn btn-primary !py-3 text-base font-semibold"
              >
                {paying ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" />处理中...</>
                ) : (
                  `立即支付 ${formatMoney(depositAmount)}`
                )}
              </button>
              <p className="mt-3 text-center text-xs text-gray-400">
                本支付为模拟演示，不会产生真实扣款
              </p>
            </>
          )}

          {step === 'paying' && (
            <div className="py-8 text-center">
              <div className="relative mx-auto w-40 h-40 mb-5">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center">
                  <QrCode className="w-24 h-24 text-gray-300" />
                </div>
                {polling && (
                  <div className="absolute inset-0 rounded-2xl bg-white/80 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-600 mb-1">请使用 <b>{channelOptions.find(c => c.key === channel)?.label}</b> 扫码支付</div>
              <div className="text-xs text-gray-400 mb-4">订单号：{outTradeNo || '生成中...'}</div>
              <div className="flex items-center justify-center gap-2 text-xs text-primary-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>正在等待支付结果...</span>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="py-6 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-1">支付成功</h4>
              <p className="text-sm text-gray-500 mb-5">{borrow.toolName} 已自动出库，请前往取件</p>

              <div className="p-4 rounded-xl bg-gray-50 text-left space-y-2 text-sm mb-5">
                <div className="flex justify-between">
                  <span className="text-gray-500">支付金额</span>
                  <span className="font-semibold text-green-700">+{formatMoney(depositAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">交易单号</span>
                  <span className="text-gray-700 font-mono text-xs">{successData?.deposit.transactionId || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">支付时间</span>
                  <span className="text-gray-700">{formatDate(successData?.deposit.payTime || new Date().toISOString())}</span>
                </div>
              </div>

              <button onClick={onClose} className="w-full btn btn-primary">
                完成
              </button>
            </div>
          )}

          {step === 'fail' && (
            <div className="py-6 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <X className="w-10 h-10 text-red-600" />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-1">支付失败</h4>
              <p className="text-sm text-red-500 mb-5">{errorMsg || '请检查支付方式后重试'}</p>

              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 btn btn-secondary">
                  关闭
                </button>
                <button onClick={handleRetry} className="flex-1 btn btn-primary">
                  重新支付
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
