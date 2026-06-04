import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { useToast } from '@/components/Toast/ToastContainer';
import { authApi } from '@/api/client';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register } = useAuthStore();
  const { show } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (code) {
      // Handle OAuth callback
      authApi.wechatCallback(code, state || undefined).then((res: any) => {
        const data = res.data;
        if (data && data.accessToken) {
          useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
          if (data.user) {
            useAuthStore.getState().setUser(data.user);
          }
          navigate('/', { replace: true });
        }
      }).catch((err: any) => {
        show(err.response?.data?.message || t('auth.wechatLoginFailed'), 'error');
        navigate('/login', { replace: true });
      });
    } else if (searchParams.get('reason') === 'expired') {
      show(t('auth.sessionExpired'), 'warning');
    }
  }, [searchParams, show, navigate]);

  const handleWechatLogin = async () => {
    try {
      const res: any = await authApi.wechatAuth();
      const { url } = res.data;
      // Open WeChat QR page - user scans QR and gets redirected back
      window.location.href = url;
    } catch {
      show(t('auth.wechatLoginInitFailed'), 'error');
    }
  };

  const [form, setForm] = useState({
    identifier: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isLogin && form.password !== form.confirmPassword) {
      setError(t('settings.passwordMismatch'));
      return;
    }

      setLoading(true);
    try {
      if (isLogin) {
        await login(form.identifier, form.password);
      } else {
        await register({
          username: form.username,
          email: form.email,
          password: form.password,
        });
      }
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || t('auth.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text mb-2">AI-Native Chat</h1>
          <p className="text-text-secondary">
            {isLogin ? t('auth.welcomeBack') : t('auth.createAccountTitle')}
          </p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {isLogin ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('auth.usernameOrEmail')}</label>
                  <input
                    type="text"
                    className="input-field"
                    value={form.identifier}
                    onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                    placeholder={t('auth.usernamePlaceholder')}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('auth.password')}</label>
                  <input
                    type="password"
                    className="input-field"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={t('auth.passwordPlaceholder')}
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('auth.username')}</label>
                  <input
                    type="text"
                    className="input-field"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder={t('auth.chooseUsername')}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('auth.email')}</label>
                  <input
                    type="email"
                    className="input-field"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder={t('auth.enterEmail')}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('auth.password')}</label>
                  <input
                    type="password"
                    className="input-field"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={t('auth.createPassword')}
                    minLength={8}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('auth.confirmPassword')}</label>
                  <input
                    type="password"
                    className="input-field"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder={t('auth.confirmYourPassword')}
                    required
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className="btn-primary w-full py-3"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {isLogin ? t('auth.signingIn') : t('auth.creatingAccount')}
                </span>
              ) : (
                isLogin ? t('auth.login') : t('auth.register')
              )}
            </button>
          </form>

          <div className="mt-4">
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-surface px-2 text-text-secondary">{t('auth.orContinueWith')}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleWechatLogin}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-border rounded-lg hover:bg-border/30 transition-colors text-sm"
            >
              <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045c.134 0 .24-.11.24-.245 0-.06-.024-.12-.04-.178l-.325-1.233a.492.492 0 0 1 .178-.554C23.028 18.48 24 16.82 24 14.98c0-3.21-2.931-5.87-7.062-6.122zm-2.18 2.876c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z"/>
              </svg>
              <span>{t('auth.continueWithWeChat')}</span>
            </button>
          </div>

          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
            >
              {isLogin ? t('auth.noAccount') : t('auth.haveAccount')}
            </button>
          </div>
        </div>

        <p className="text-center text-text-secondary text-xs mt-6">
          Powered by DeepSeek AI &bull; AI-Native Architecture
        </p>
      </div>
    </div>
  );
}
