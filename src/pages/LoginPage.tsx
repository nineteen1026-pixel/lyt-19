import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Send, LogIn, ShieldCheck, Home, User as UserIcon, Phone, Hash } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, sendCode, loading, user } = useAuthStore();
  const [step, setStep] = useState<'phone' | 'verify'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [debugCode, setDebugCode] = useState<string | undefined>();
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<number | null>(null);
  const from = (location.state as { from?: string })?.from || '/';

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = window.setTimeout(() => setCountdown(c => c - 1), 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [countdown]);

  const validatePhone = (p: string) => /^1[3-9]\d{9}$/.test(p);

  const handleSendCode = async () => {
    if (!validatePhone(phone)) {
      alert('请输入有效的手机号码');
      return;
    }
    try {
      const code = await sendCode(phone);
      setDebugCode(code);
      setStep('verify');
      setCountdown(60);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      alert('请输入6位验证码');
      return;
    }
    try {
      const user = await login({
        phone,
        code,
        name: isNewUser ? name : undefined,
        room: isNewUser ? room : undefined,
      });
      navigate(from, { replace: true });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('首次登录请填写姓名') || msg.includes('首次登录请填写房号')) {
        setIsNewUser(true);
        alert(msg + '\n\n这是您首次登录，请填写姓名和房号完成注册');
      } else {
        alert(msg);
      }
    }
  };

  const goBack = () => {
    if (step === 'verify') {
      setStep('phone');
      setCode('');
      setDebugCode(undefined);
      setCountdown(0);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card p-8 shadow-xl">
          <div className="mb-8">
            <button onClick={goBack} className="btn btn-secondary mb-6 !py-2">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              {step === 'verify' ? '修改手机号' : '返回'}
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <Home className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">小区工具借还站</h1>
                <p className="text-sm text-gray-500">邻里共享 · 便捷生活</p>
              </div>
            </div>
          </div>

          {step === 'phone' && (
            <form onSubmit={(e) => { e.preventDefault(); handleSendCode(); }} className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">手机号登录</h2>
                <p className="text-sm text-gray-500">输入手机号获取验证码，首次登录将自动注册</p>
              </div>

              <div>
                <label className="label">
                  <Phone className="w-4 h-4 mr-1.5" />
                  手机号码
                </label>
                <input
                  type="tel"
                  className="input text-lg tracking-wider"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="请输入11位手机号"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || !validatePhone(phone)}
                className="btn btn-primary w-full !py-3 text-base"
              >
                <Send className="w-4 h-4 mr-1.5" />
                {loading ? '发送中...' : '获取验证码'}
              </button>

              <div className="text-center text-xs text-gray-400 pt-2">
                登录即代表同意《用户协议》和《隐私政策》
              </div>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">输入验证码</h2>
                <p className="text-sm text-gray-500">
                  验证码已发送至 <b className="text-primary-700">{phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</b>
                </p>
              </div>

              {debugCode && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  <span><b>开发模式</b>：验证码为 <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">{debugCode}</code></span>
                </div>
              )}

              <div>
                <label className="label">验证码</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="input flex-1 text-lg tracking-[0.5em] font-mono text-center"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    autoFocus
                    maxLength={6}
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={countdown > 0 || loading}
                    className="btn btn-secondary whitespace-nowrap"
                  >
                    {countdown > 0 ? `${countdown}s` : '重新获取'}
                  </button>
                </div>
              </div>

              {isNewUser && (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg space-y-4">
                  <div className="text-sm font-medium text-amber-800 flex items-center gap-1.5">
                    <UserIcon className="w-4 h-4" />
                    完善个人信息（首次注册）
                  </div>
                  <div>
                    <label className="label">姓名</label>
                    <input
                      type="text"
                      className="input"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="请输入您的姓名"
                    />
                  </div>
                  <div>
                    <label className="label">
                      <Hash className="w-4 h-4 mr-1.5" />
                      房号
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={room}
                      onChange={e => setRoom(e.target.value)}
                      placeholder="例如：3栋2单元501"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code.length !== 6 || (isNewUser && (!name.trim() || !room.trim()))}
                className="btn btn-primary w-full !py-3 text-base"
              >
                <LogIn className="w-4 h-4 mr-1.5" />
                {loading ? '登录中...' : isNewUser ? '注册并登录' : '登录'}
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-gray-100">
            <Link to="/" className="text-sm text-primary-600 hover:text-primary-700 flex items-center justify-center gap-1">
              <Home className="w-4 h-4" />
              返回首页浏览工具
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
