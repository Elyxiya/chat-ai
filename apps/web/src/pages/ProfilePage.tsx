import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { userApi } from '@/api/client';

export default function ProfilePage() {
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
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
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
      setPasswordError(err?.response?.data?.message || 'Failed to change password');
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
        <h1 className="font-semibold text-sm">Profile Settings</h1>
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
              {uploading ? 'Uploading...' : 'Change avatar'}
            </button>
          </div>

          {/* Profile Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Profile Info</h3>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Username</label>
              <input type="text" value={user?.username || ''} disabled className="input-field w-full text-sm bg-bg/50" />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
              <input type="email" value={user?.email || ''} disabled className="input-field w-full text-sm bg-bg/50" />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Nickname</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Set a display name"
                className="input-field w-full text-sm"
                maxLength={30}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
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
              {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>

          {/* Change Password */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Change Password</h3>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input-field w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Confirm New Password</label>
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
              <p className="text-xs text-green-500">Password changed successfully</p>
            )}

            <button
              onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="w-full px-4 py-2 bg-bg border border-border rounded-lg hover:bg-border disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {changingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </div>

          {/* Account Info */}
          <div className="space-y-2 text-xs text-text-secondary">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Account</h3>
            <p>Member since: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
