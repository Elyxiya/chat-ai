import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatStore } from '@/stores/chat.store';

export default function GroupManagementPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { sessions } = useChatStore();
  const [members, setMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const session = sessions.find((s) => s.id === sessionId);
  const isGroup = session?.sessionType === 'group' || session?.sessionType === 'channel';

  useEffect(() => {
    if (!isGroup || !sessionId) return;
    const loadMembers = async () => {
      try {
        const res = await fetch(`/api/v1/chat/sessions/${sessionId}/members`, {
          headers: {
            Authorization: `Bearer ${JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.accessToken || ''}`,
          },
        });
        const data = await res.json();
        setMembers(data.data || []);
      } catch { /* ignore */ }
    };
    loadMembers();
  }, [sessionId, isGroup]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !sessionId) return;
    setLoading(true);
    try {
      await fetch(`/api/v1/chat/sessions/${sessionId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.accessToken || ''}`,
        },
        body: JSON.stringify({ email: inviteEmail }),
      });
      setInviteEmail('');
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!sessionId) return;
    try {
      await fetch(`/api/v1/chat/sessions/${sessionId}/members/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.accessToken || ''}`,
        },
      });
      setMembers((prev) => prev.filter((m) => m.user?.id !== userId));
    } catch { /* ignore */ }
  };

  if (!isGroup) {
    return (
      <div className="p-8 text-center text-text-secondary">
        <p>This page is only for group chats.</p>
        <button onClick={() => navigate(-1)} className="btn-primary mt-4">Go Back</button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-72 border-r border-border bg-surface flex flex-col">
        <div className="p-4 border-b border-border">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-text-secondary hover:text-text mb-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Back to chat</span>
          </button>
          <h2 className="font-semibold text-lg">{session?.name || 'Group Settings'}</h2>
          <p className="text-xs text-text-secondary mt-1">{session?.sessionType} · {members.length} members</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Members ({members.length})</h3>
            <div className="space-y-1">
              {members.map((m) => (
                <div key={m.user?.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-bg">
                  <div className="relative">
                    <img
                      src={m.user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${m.user?.username}`}
                      alt={m.user?.username}
                      className="w-8 h-8 rounded-full"
                    />
                    {m.user?.status === 'online' && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-surface rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.user?.nickname || m.user?.username}</p>
                    <p className="text-xs text-text-secondary capitalize">{m.role}</p>
                  </div>
                  {m.role !== 'owner' && (
                    <button
                      onClick={() => handleRemoveMember(m.user?.id)}
                      className="p-1 text-text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        <div>
          <h3 className="text-sm font-medium mb-2">Invite by Email</h3>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="friend@example.com"
              className="input-field flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            />
            <button onClick={handleInvite} disabled={loading || !inviteEmail.trim()} className="btn-primary">
              {loading ? '...' : 'Invite'}
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-2">Group Info</h3>
          <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Name</span>
              <span className="text-sm font-medium">{session?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Type</span>
              <span className="text-sm capitalize">{session?.sessionType}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Members</span>
              <span className="text-sm">{members.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Created</span>
              <span className="text-sm">{session?.createdAt ? new Date(session.createdAt).toLocaleDateString() : 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
