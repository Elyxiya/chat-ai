import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { chatApi } from '@/api/client';

interface PendingApplication {
  id: string;
  userId: string;
  reason: string | null;
  status: string;
  createdAt: string;
  user: { id: string; username: string; nickname: string | null; avatarUrl: string | null };
}

interface ChannelMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: { id: string; username: string; nickname: string | null; avatarUrl: string | null; status: string };
}

interface SearchUserResult {
  id: string;
  username: string;
  nickname: string | null;
  avatarUrl: string | null;
  status: string;
}

export default function ChannelSettingsPage() {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [joinApproval, setJoinApproval] = useState('none');
  const [applications, setApplications] = useState<PendingApplication[]>([]);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [myRole, setMyRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'applications' | 'members' | 'settings'>('settings');
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<SearchUserResult[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSending, setInviteSending] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const [sessionRes, membersRes] = await Promise.all([
        chatApi.getSession(sessionId),
        chatApi.getSessionMembers(sessionId),
      ]);
      const session = sessionRes.data || {};
      setJoinApproval(session.joinApproval || 'none');
      setMembers((membersRes.data || []).filter((m: any) => m.user));

      // Find current user's role
      const currentUserId = (await chatApi.getSession(sessionId)).data?.owner?.id;
      // Load the applications if admin
      const myMembership = (membersRes.data || []).find((m: any) => m.role === 'owner' || m.role === 'admin');
      if (myMembership) {
        setMyRole(myMembership.role);
        // Load pending applications
        try {
          const appRes: any = await chatApi.getPendingApplications(sessionId);
          setApplications((appRes.data || []).filter((a: any) => a.status === 'pending'));
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSearchUsers = async () => {
    if (!inviteQuery.trim() || !sessionId) return;
    setInviteLoading(true);
    try {
      const res: any = await chatApi.searchUsers(inviteQuery);
      const users: SearchUserResult[] = res.data || [];
      const memberIds = new Set(members.map((m) => m.userId));
      setInviteResults(users.filter((u) => !memberIds.has(u.id)));
    } catch { /* ignore */ }
    setInviteLoading(false);
  };

  const handleInviteUser = async (userId: string) => {
    if (!sessionId) return;
    setInviteSending((prev) => new Set(prev).add(userId));
    try {
      await chatApi.inviteToChannel(sessionId, userId);
      setInviteResults((prev) => prev.filter((u) => u.id !== userId));
    } catch { /* ignore */ }
    setInviteSending((prev) => { const next = new Set(prev); next.delete(userId); return next; });
  };

  const handleApprovalChange = async (mode: string) => {
    if (!sessionId) return;
    try {
      await chatApi.updateChannelJoinApproval(sessionId, mode);
      setJoinApproval(mode);
    } catch { /* ignore */ }
  };

  const handleApprove = async (userId: string) => {
    if (!sessionId) return;
    setProcessing((prev) => new Set(prev).add(`approve-${userId}`));
    try {
      await chatApi.approveJoinApplication(sessionId, userId);
      setApplications((prev) => prev.filter((a) => a.userId !== userId));
    } catch { /* ignore */ }
    setProcessing((prev) => { const next = new Set(prev); next.delete(`approve-${userId}`); return next; });
  };

  const handleReject = async (userId: string) => {
    if (!sessionId) return;
    setProcessing((prev) => new Set(prev).add(`reject-${userId}`));
    try {
      await chatApi.rejectJoinApplication(sessionId, userId);
      setApplications((prev) => prev.filter((a) => a.userId !== userId));
    } catch { /* ignore */ }
    setProcessing((prev) => { const next = new Set(prev); next.delete(`reject-${userId}`); return next; });
  };

  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'owner' || myRole === 'admin';

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <header className="h-14 px-4 border-b border-border flex items-center gap-3 bg-surface flex-shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="p-1 hover:bg-border rounded transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-semibold text-sm">{t('chat.channelSettings')}</h2>
      </header>

      {/* Tabs */}
      {isAdmin && (
        <div className="flex border-b border-border bg-surface">
          {(['settings', 'applications', 'members'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-text-secondary hover:text-text'
              }`}
            >
              {tab === 'settings' ? t('chat.tabSettings') : tab === 'applications' ? `${t('chat.applications')} (${applications.length})` : t('chat.members')}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-text-secondary text-sm">{t('common.loading')}</p>
          </div>
        ) : activeTab === 'settings' && isOwner ? (
          <div>
            <h3 className="text-sm font-semibold mb-3">{t('chat.joinApprovalTitle')}</h3>
            <div className="space-y-2">
              {[
                { value: 'none', label: t('chat.anyoneCanJoin'), desc: t('chat.anyoneCanJoinDesc') },
                { value: 'approval', label: t('chat.requiresApprovalLabel'), desc: t('chat.requiresApprovalDesc') },
                { value: 'invite_only', label: t('chat.inviteOnly'), desc: t('chat.inviteOnlyDesc') },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    joinApproval === opt.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-border hover:bg-bg'
                  }`}
                >
                  <input
                    type="radio"
                    name="joinApproval"
                    value={opt.value}
                    checked={joinApproval === opt.value}
                    onChange={() => handleApprovalChange(opt.value)}
                    className="mt-0.5 accent-primary-600"
                  />
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-text-secondary mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ) : activeTab === 'applications' && isAdmin ? (
          <div>
            <h3 className="text-sm font-semibold mb-3">
              {t('chat.pendingApplications')} ({applications.length})
            </h3>
            {applications.length === 0 ? (
              <p className="text-sm text-text-secondary">{t('chat.noPendingApplications')}</p>
            ) : (
              <div className="space-y-2">
                {applications.map((app) => (
                  <div key={app.id} className="card p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center overflow-hidden flex-shrink-0">
                      {app.user?.avatarUrl ? (
                        <img src={app.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {app.user?.nickname || app.user?.username || 'Unknown'}
                      </p>
                      {app.reason && (
                        <p className="text-xs text-text-secondary truncate">{app.reason}</p>
                      )}
                      <p className="text-xs text-text-secondary mt-0.5">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleApprove(app.userId)}
                        disabled={processing.has(`approve-${app.userId}`) || processing.has(`reject-${app.userId}`)}
                        className="px-2.5 py-1 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                      >
                        {processing.has(`approve-${app.userId}`) ? '...' : t('chat.approve')}
                      </button>
                      <button
                        onClick={() => handleReject(app.userId)}
                        disabled={processing.has(`approve-${app.userId}`) || processing.has(`reject-${app.userId}`)}
                        className="px-2.5 py-1 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                      >
                        {processing.has(`reject-${app.userId}`) ? '...' : t('chat.reject')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'members' || (activeTab === 'settings' && !isOwner) ? (
          <div>
            <h3 className="text-sm font-semibold mb-3">{t('chat.membersCount', { count: members.length })}</h3>

            {isAdmin && (
              <div className="mb-4 p-3 bg-surface border border-border rounded-lg">
                <p className="text-xs font-medium mb-2">{t('chat.inviteMembers') || 'Invite members'}</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteQuery}
                    onChange={(e) => setInviteQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                    placeholder={t('chat.searchUsers')}
                    className="input-field flex-1 text-xs"
                  />
                  <button
                    onClick={handleSearchUsers}
                    disabled={inviteLoading || !inviteQuery.trim()}
                    className="btn-primary px-3 py-1 text-xs disabled:opacity-50"
                  >
                    {inviteLoading ? '...' : t('common.search')}
                  </button>
                </div>

                {inviteResults.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {inviteResults.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-2 rounded bg-bg">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-border flex items-center justify-center overflow-hidden flex-shrink-0">
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <svg className="w-3 h-3 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm truncate">{u.nickname || u.username}</span>
                        </div>
                        <button
                          onClick={() => handleInviteUser(u.id)}
                          disabled={inviteSending.has(u.id)}
                          className="px-2 py-0.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 transition-colors flex-shrink-0"
                        >
                          {inviteSending.has(u.id) ? '...' : t('chat.invite') || 'Invite'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {inviteResults.length === 0 && inviteQuery.trim() && !inviteLoading && (
                  <p className="text-xs text-text-secondary mt-1">{t('admin.noUsers') || 'No users found'}</p>
                )}
              </div>
            )}

            <div className="space-y-1">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-bg transition-colors">
                  <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center overflow-hidden flex-shrink-0">
                    {m.user?.avatarUrl ? (
                      <img src={m.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{m.user?.nickname || m.user?.username || 'Unknown'}</p>
                  </div>
                  {m.role === 'owner' && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">Owner</span>
                  )}
                  {m.role === 'admin' && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Admin</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">{t('common.loading')}</p>
        )}
      </div>
    </div>
  );
}
