import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { userApi } from '@/api/client';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { user, logout, updateUser } = useAuthStore();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      await userApi.updateProfile({ nickname, bio });
      updateUser({ nickname, bio });
      setMsg('Saved successfully');
    } catch (err: any) {
      setMsg(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const res: any = await userApi.uploadAvatar(file);
      const avatarUrl = res.data?.data?.avatarUrl || res.data?.avatarUrl;
      if (avatarUrl) {
        updateUser({ avatarUrl });
      }
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      {/* Language */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t('settings.language')}</h2>
        <div className="flex gap-2">
          {[
            { code: 'zh-CN', label: t('settings.languageZh') },
            { code: 'en-US', label: t('settings.languageEn') },
          ].map((lang) => (
            <button
              key={lang.code}
              onClick={() => i18n.changeLanguage(lang.code)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                i18n.language === lang.code
                  ? 'bg-primary-600 text-white'
                  : 'bg-border hover:bg-border/80'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Profile */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t('profile.profileInfo')}</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.username}`}
              alt={user?.username}
              className="w-20 h-20 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => avatarInputRef.current?.click()}
            />
            {uploadingAvatar && (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                <span className="text-white text-xs font-medium">Uploading...</span>
              </div>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary-600 text-white rounded-full flex items-center justify-center hover:bg-primary-700 transition-colors shadow-md"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          <div>
            <p className="font-medium">{user?.username}</p>
            <p className="text-sm text-text-secondary">{user?.email}</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('profile.nickname')}</label>
          <input
            type="text"
            className="input-field"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={t('profile.nicknamePlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('profile.bio')}</label>
          <textarea
            className="input-field resize-none"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t('profile.bioPlaceholder')}
          />
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? t('common.saving') : t('common.save')}
        </button>
        {msg && <p className="text-sm text-primary-600">{msg}</p>}
      </div>

      {/* AI Settings */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t('agent.title')}</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{t('settings.title')}</p>
            <p className="text-sm text-text-secondary">Choose default reasoning mode</p>
          </div>
          <select className="input-field w-40">
            <option value="react">ReAct</option>
            <option value="planner">Plan-and-Execute</option>
            <option value="reasoner">Reasoner</option>
          </select>
        </div>
      </div>

      {/* Account */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Account</h2>
        <button
          onClick={() => logout()}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
        >
          {t('auth.logout')}
        </button>
      </div>
    </div>
  );
}
