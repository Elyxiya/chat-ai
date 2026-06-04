import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { userApi } from '@/api/client';

export default function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState(user?.nickname || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (user?.nickname) setNickname(user.nickname);
    if (user?.bio) setBio(user.bio);
  }, [user]);

  const [status, setStatus] = useState<string>(user?.status || 'online');

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus);
    try {
      await userApi.updateStatus(newStatus);
      if (user) setUser({ ...user, status: newStatus as any });
    } catch { setStatus(user?.status ?? 'online'); }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res: any = await userApi.updateProfile({ nickname, bio });
      if (res?.data) setUser(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleAvatarSelect = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview locally
    setAvatarPreview(URL.createObjectURL(file));

    setUploading(true);
    try {
      const res: any = await userApi.uploadAvatar(file);
      const avatarUrl = res.data?.avatarUrl || res.avatarUrl;
      if (avatarUrl && user) setUser({ ...user, avatarUrl });
    } catch { /* ignore */ }
    setUploading(false);
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError(t('settings.passwordMinLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('settings.passwordMismatch'));
      return;
    }

    setChangingPassword(true);
    try {
      const { authApi } = await import('@/api/client');
      await authApi.changePassword?.(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(err?.response?.data?.message || t('agent.error'));
    }
    setChangingPassword(false);
  };

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <header className="h-14 px-4 border-b border-border flex items-center gap-3 bg-surface flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-border rounded-lg transition-colors">
          <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-semibold text-sm">{t('profile.title')}</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto p-6 space-y-8">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <img
                src={avatarPreview || user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.username}`}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover border-4 border-border"
              />
              {uploading && (
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button onClick={handleAvatarSelect} className="text-sm text-primary-600 hover:underline" disabled={uploading}>
              {uploading ? t('common.uploading') : t('profile.changeAvatar')}
            </button>
          </div>

          {/* Status */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('profile.status')}</h3>
            <div className="flex gap-2">
              {[
                { value: 'online', label: t('profile.online'), color: 'bg-green-500' },
                { value: 'away', label: t('profile.away'), color: 'bg-yellow-500' },
                { value: 'busy', label: t('profile.busy'), color: 'bg-red-500' },
                { value: 'invisible', label: t('profile.invisible'), color: 'bg-gray-400' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    status === opt.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700'
                      : 'border-border hover:bg-border/50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Profile Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('profile.profileInfo')}</h3>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">{t('auth.username')}</label>
              <input type="text" value={user?.username || ''} disabled className="input-field w-full text-sm bg-bg/50" />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">{t('auth.email')}</label>
              <input type="email" value={user?.email || ''} disabled className="input-field w-full text-sm bg-bg/50" />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">{t('profile.nickname')}</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={t('profile.nicknamePlaceholder')}
                className="input-field w-full text-sm"
                maxLength={30}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">{t('profile.bio')}</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t('profile.bioPlaceholder')}
                className="input-field w-full text-sm resize-none"
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-text-secondary mt-1">{bio.length}/200</p>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>

          {/* Change Password */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('settings.changePassword')}</h3>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">{t('settings.currentPassword')}</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input-field w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">{t('settings.newPassword')}</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">{t('settings.confirmNewPassword')}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field w-full text-sm"
              />
            </div>

            {passwordError && (
              <p className="text-xs text-red-500">{passwordError}</p>
            )}
            {passwordSuccess && (
              <p className="text-xs text-green-500">{t('settings.passwordChanged')}</p>
            )}

            <button
              onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="w-full px-4 py-2 bg-bg border border-border rounded-lg hover:bg-border disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {changingPassword ? t('common.saving') : t('settings.changePassword')}
            </button>
          </div>

          {/* Account Info */}
          <div className="space-y-2 text-xs text-text-secondary">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('profile.title')}</h3>
            <p>{t('profile.joined')}: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
