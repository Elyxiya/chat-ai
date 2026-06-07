import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import { chatApi } from '@/api/client';

export default function GroupManagementPage() {
  const { t } = useTranslation();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { sessions } = useChatStore();
  const { user } = useAuthStore();
  const [members, setMembers] = useState<any[]>([]);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<any[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSending, setInviteSending] = useState<Set<string>>(new Set());
  const [editingName, setEditingName] = useState(false);
  const [editNameInput, setEditNameInput] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  const session = sessions.find((s) => s.id === sessionId);
  const isGroup = session?.sessionType === 'group';

  useEffect(() => {
    if (!isGroup || !sessionId) return;
    loadMembers();
  }, [sessionId, isGroup]);

  const loadMembers = async () => {
    try {
      const res: any = await chatApi.getSessionMembers(sessionId!);
      setMembers(res.data || []);
    } catch { /* ignore */ }
  };

  const handleSearchInvite = async () => {
    if (!inviteQuery.trim()) return;
    setInviteLoading(true);
    try {
      const res: any = await chatApi.searchUsers(inviteQuery);
      const users = res.data || [];
      const memberIds = new Set(members.map((m: any) => m.user?.id));
      setInviteResults(users.filter((u: any) => !memberIds.has(u.id)));
    } catch { /* ignore */ }
    setInviteLoading(false);
  };

  const handleInviteUser = async (userId: string) => {
    if (!sessionId) return;
    setInviteSending((prev) => new Set(prev).add(userId));
    try {
      await chatApi.addMembers(sessionId, [userId]);
      setInviteResults((prev) => prev.filter((u) => u.id !== userId));
      await loadMembers();
    } catch { /* ignore */ }
    setInviteSending((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  };

  const handleRemoveMember = async (userId: string) => {
    if (!sessionId) return;
    try {
      await chatApi.removeMember(sessionId, userId);
      setMembers((prev) => prev.filter((m: any) => m.user?.id !== userId));
    } catch { /* ignore */ }
  };

  const handleUpdateName = async () => {
    if (!sessionId || !editNameInput.trim()) return;
    try {
      await chatApi.updateSession(sessionId, { name: editNameInput.trim() });
      setEditingName(false);
      await useChatStore.getState().loadSessions();
    } catch { /* ignore */ }
  };

  const handleGenerateInviteLink = async () => {
    if (!sessionId) return;
    try {
      const res: any = await chatApi.generateInviteLink(sessionId);
      const code = res.data?.inviteCode || '';
      setInviteLink(`${window.location.origin}/chat?join=${code}`);
    } catch { /* ignore */ }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleSetRole = async (targetUserId: string, role: string) => {
    if (!sessionId) return;
    setProcessing((prev) => new Set(prev).add(`role-${targetUserId}`));
    try {
      await chatApi.setMemberRole(sessionId, targetUserId, role);
      setMembers((prev) => prev.map((m: any) => m.userId === targetUserId ? { ...m, role } : m));
    } catch { /* ignore */ }
    setProcessing((prev) => { const next = new Set(prev); next.delete(`role-${targetUserId}`); return next; });
  };

  if (!isGroup) {
    return (
      <div className="p-8 text-center text-text-secondary">
        <p>{t('chat.groupOnly') || 'This page is only for group chats.'}</p>
        <button onClick={() => navigate(-1)} className="btn-primary mt-4">{t('common.back')}</button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar - member list */}
      <aside className="w-72 border-r border-border bg-surface flex flex-col">
        <div className="p-4 border-b border-border">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-text-secondary hover:text-text mb-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">{t('common.back')}</span>
          </button>
          <h2 className="font-semibold text-lg">{session?.name || t('chat.groupInfo')}</h2>
          <p className="text-xs text-text-secondary mt-1">{session?.sessionType} · {members.length} {t('chat.members')}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">{t('chat.members')} ({members.length})</h3>
            <div className="space-y-1">
              {members.map((m: any) => (
                <div key={m.user?.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-bg group">
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
                  {session?.ownerId === user?.id && m.role !== 'owner' && (
                    <>
                      <button
                        onClick={() => handleSetRole(m.user?.id, m.role === 'admin' ? 'member' : 'admin')}
                        disabled={processing.has(`role-${m.user?.id}`)}
                        className="p-1 text-text-secondary hover:text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title={m.role === 'admin' ? 'Demote to member' : 'Promote to admin'}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRemoveMember(m.user?.id)}
                        disabled={processing.has(`role-${m.user?.id}`)}
                        className="p-1 text-text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main - settings */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Group name */}
        <div>
          <h3 className="text-sm font-medium mb-2">{t('chat.groupInfo')}</h3>
          <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">{t('knowledge.baseName')}</span>
              {editingName ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editNameInput}
                    onChange={(e) => setEditNameInput(e.target.value)}
                    className="input-field text-xs w-40"
                    autoFocus
                  />
                  <button onClick={handleUpdateName} className="btn-primary px-2 py-1 text-xs">Save</button>
                  <button onClick={() => setEditingName(false)} className="px-2 py-1 text-xs border border-border rounded hover:bg-border">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{session?.name}</span>
                  <button onClick={() => { setEditNameInput(session?.name || ''); setEditingName(true); }} className="text-xs text-primary-600 hover:underline">{t('common.edit') || 'Edit'}</button>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">{t('admin.type') || 'Type'}</span>
              <span className="text-sm capitalize">{session?.sessionType}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">{t('chat.members')}</span>
              <span className="text-sm">{members.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">{t('admin.joined')}</span>
              <span className="text-sm">{session?.createdAt ? new Date(session.createdAt).toLocaleDateString() : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Invite members */}
        <div>
          <h3 className="text-sm font-medium mb-2">{t('chat.searchUsers')}</h3>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={inviteQuery}
              onChange={(e) => setInviteQuery(e.target.value)}
              placeholder={t('chat.searchUsers')}
              className="input-field flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleSearchInvite()}
            />
            <button onClick={handleSearchInvite} disabled={inviteLoading || !inviteQuery.trim()} className="btn-primary px-4">
              {inviteLoading ? t('common.loading') : t('common.search')}
            </button>
          </div>
          {inviteResults.length > 0 && (
            <div className="space-y-2 mb-3">
              {inviteResults.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between p-2 rounded-lg bg-bg hover:bg-border transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={u.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}`}
                      alt={u.username}
                      className="w-8 h-8 rounded-full flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{u.nickname || u.username}</p>
                      <p className="text-xs text-text-secondary truncate">@{u.username}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleInviteUser(u.id)}
                    disabled={inviteSending.has(u.id)}
                    className="btn-primary px-3 py-1 text-xs flex-shrink-0"
                  >
                    {inviteSending.has(u.id) ? t('common.loading') : t('chat.invite') || 'Invite'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {inviteResults.length === 0 && inviteQuery.trim() && !inviteLoading && (
            <p className="text-xs text-text-secondary">{t('admin.noUsers')}</p>
          )}
        </div>

        {/* Invite link */}
        <div>
          <h3 className="text-sm font-medium mb-2">{t('chat.inviteLink') || 'Invite link'}</h3>
          <div className="bg-surface border border-border rounded-xl p-4">
            {inviteLink ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="input-field flex-1 text-xs"
                  onFocus={(e) => e.target.select()}
                />
                <button onClick={handleCopyLink} className="btn-primary px-3 py-1 text-xs flex-shrink-0">
                  {copied ? (t('common.copied') || 'Copied!') : (t('common.copy') || 'Copy')}
                </button>
              </div>
            ) : (
              <button onClick={handleGenerateInviteLink} className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors">
                {t('chat.generateLink') || 'Generate link'}
              </button>
            )}
          </div>
        </div>

        {/* Member roles info */}
        <div className="bg-surface border border-border rounded-xl p-4 text-xs text-text-secondary space-y-1">
          <p><span className="font-semibold text-yellow-700">Owner</span> — can delete group, manage roles</p>
          <p><span className="font-semibold text-blue-700">Admin</span> — can add/remove members, edit info</p>
          <p><span className="font-semibold">Member</span> — can send messages</p>
        </div>
      </div>
    </div>
  );
}
