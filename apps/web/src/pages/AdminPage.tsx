import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useNavigate } from 'react-router-dom';

interface AdminUser {
  id: string;
  username: string;
  email: string;
  nickname?: string | null;
  role: string;
  status: string;
  createdAt: string;
  _count?: { sentMessages: number; sessions: number };
}

interface AuditLog {
  id: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata: any;
  createdAt: string;
  user?: { id: string; username: string };
}

interface SystemSetting {
  key: string;
  value: any;
  description?: string;
  updatedAt: string;
}

interface AdminStats {
  userCount: number;
  sessionCount: number;
  messageCount: number;
  recentUsers: AdminUser[];
  recentLogs: AuditLog[];
}

type Tab = 'users' | 'settings' | 'logs';

export default function AdminPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/chat');
    }
  }, [user, navigate]);

  useEffect(() => {
    adminApi.getStats().then((res: any) => setStats(res.data)).catch(() => {});
  }, []);

  if (!user || user.role !== 'admin') return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'users', label: 'Users' },
    { key: 'settings', label: 'Settings' },
    { key: 'logs', label: 'Audit Logs' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <h1 className="text-xl font-bold">Admin Panel</h1>
        {stats && (
          <div className="flex gap-6 mt-2 text-sm text-text-secondary">
            <span>{stats.userCount} users</span>
            <span>{stats.sessionCount} sessions</span>
            <span>{stats.messageCount} messages</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 py-2 border-b border-border bg-surface">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === t.key
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'text-text-secondary hover:bg-border'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'settings' && <SettingsPanel />}
        {activeTab === 'logs' && <AuditLogs />}
      </div>
    </div>
  );
}

function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const limit = 15;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await adminApi.listUsers({ page, limit, search: search || undefined });
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleBan = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'banned' ? 'offline' : 'banned';
    await adminApi.updateUserStatus(userId, newStatus);
    fetchUsers();
  };

  const handleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    await adminApi.updateUserRole(userId, newRole);
    fetchUsers();
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Delete this user and all their data? This cannot be undone.')) return;
    await adminApi.deleteUser(userId);
    fetchUsers();
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by username, email or nickname..."
          className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <span className="text-sm text-text-secondary">{total} users</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-secondary">
              <th className="pb-2 font-medium">Username</th>
              <th className="pb-2 font-medium">Email</th>
              <th className="pb-2 font-medium">Role</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">Messages</th>
              <th className="pb-2 font-medium">Joined</th>
              <th className="pb-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border hover:bg-bg/50">
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{u.nickname || u.username}</span>
                    <span className="text-xs text-text-secondary">@{u.username}</span>
                  </div>
                </td>
                <td className="py-2.5 pr-4 text-text-secondary">{u.email}</td>
                <td className="py-2.5 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    u.role === 'admin'
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-text-secondary'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="py-2.5 pr-4">
                  <span className={`inline-flex items-center gap-1 ${
                    u.status === 'banned' ? 'text-red-500' : u.status === 'online' ? 'text-green-500' : 'text-text-secondary'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      u.status === 'online' ? 'bg-green-500' : u.status === 'banned' ? 'bg-red-500' : 'bg-gray-400'
                    }`} />
                    {u.status}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-text-secondary">{u._count?.sentMessages || 0}</td>
                <td className="py-2.5 pr-4 text-text-secondary text-xs">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="py-2.5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleBan(u.id, u.status)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        u.status === 'banned'
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-200'
                          : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-200'
                      }`}
                    >
                      {u.status === 'banned' ? 'Unban' : 'Ban'}
                    </button>
                    <button
                      onClick={() => handleRole(u.id, u.role)}
                      className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 transition-colors"
                    >
                      {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-text-secondary rounded hover:bg-red-100 hover:text-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && !loading && (
              <tr><td colSpan={7} className="py-8 text-center text-text-secondary">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-text-secondary">
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-surface"
            >
              Previous
            </button>
            <button
              disabled={page >= Math.ceil(total / limit)}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-surface"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsPanel() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const fetchSettings = useCallback(async () => {
    try {
      const res: any = await adminApi.getSettings();
      setSettings(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleUpdate = async (key: string, value: any) => {
    await adminApi.updateSetting(key, value);
    fetchSettings();
  };

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    await adminApi.updateSetting(newKey, newValue, newDesc || undefined);
    setNewKey(''); setNewValue(''); setNewDesc('');
    fetchSettings();
  };

  return (
    <div>
      <div className="mb-6 p-4 bg-surface border border-border rounded-lg">
        <h3 className="font-medium text-sm mb-3">Add Setting</h3>
        <div className="flex flex-wrap gap-2">
          <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Key" className="flex-1 min-w-[120px] px-3 py-1.5 bg-bg border border-border rounded text-sm" />
          <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Value (JSON)" className="flex-1 min-w-[120px] px-3 py-1.5 bg-bg border border-border rounded text-sm" />
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description" className="flex-1 min-w-[120px] px-3 py-1.5 bg-bg border border-border rounded text-sm" />
          <button onClick={handleAdd} className="px-4 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700">Add</button>
        </div>
      </div>

      <div className="space-y-2">
        {settings.map((s) => (
          <div key={s.key} className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{s.key}</p>
              {s.description && <p className="text-xs text-text-secondary">{s.description}</p>}
            </div>
            <input
              defaultValue={typeof s.value === 'string' ? s.value : JSON.stringify(s.value)}
              onBlur={(e) => {
                let val: any = e.target.value;
                try { val = JSON.parse(val); } catch { /* keep string */ }
                handleUpdate(s.key, val);
              }}
              className="w-48 px-2 py-1 bg-bg border border-border rounded text-sm"
            />
          </div>
        ))}
        {settings.length === 0 && (
          <p className="text-center text-text-secondary py-8 text-sm">No settings configured yet</p>
        )}
      </div>
    </div>
  );
}

function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const limit = 20;

  const fetchLogs = useCallback(async () => {
    try {
      const res: any = await adminApi.listAuditLogs({ page, limit, action: actionFilter || undefined });
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch { /* ignore */ }
  }, [page, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          placeholder="Filter by action..."
          className="px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none"
        />
        <span className="text-sm text-text-secondary">{total} entries</span>
      </div>

      <div className="space-y-1">
        {logs.map((log) => (
          <div key={log.id} className="flex items-center gap-3 p-2.5 bg-surface border border-border rounded-lg text-sm">
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">{log.action}</span>
            <span className="text-text-secondary text-xs">{log.user?.username || 'system'}</span>
            {log.resourceType && (
              <span className="text-text-secondary text-xs">
                on {log.resourceType}/{log.resourceId?.slice(0, 8) || '-'}
              </span>
            )}
            <span className="flex-1 text-right text-xs text-text-secondary">
              {new Date(log.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <p className="text-center text-text-secondary py-8 text-sm">No audit logs found</p>
        )}
      </div>

      {total > limit && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-text-secondary">Page {page} of {Math.ceil(total / limit)}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-surface">Previous</button>
            <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-surface">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
