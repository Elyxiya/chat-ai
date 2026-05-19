import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { userApi } from '@/api/client';

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSave = async () => {
    setSaving(true);
    try {
      await userApi.updateProfile({ nickname, bio });
      setMsg('Saved successfully');
    } catch (err: any) {
      setMsg(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Profile */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="flex items-center gap-4">
          <img
            src={user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.username}`}
            alt={user?.username}
            className="w-20 h-20 rounded-full"
          />
          <div>
            <p className="font-medium">{user?.username}</p>
            <p className="text-sm text-text-secondary">{user?.email}</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Nickname</label>
          <input
            type="text"
            className="input-field"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Display name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Bio</label>
          <textarea
            className="input-field resize-none"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself"
          />
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {msg && <p className="text-sm text-primary-600">{msg}</p>}
      </div>

      {/* AI Settings */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">AI Agent Settings</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Default Mode</p>
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
          onClick={logout}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
