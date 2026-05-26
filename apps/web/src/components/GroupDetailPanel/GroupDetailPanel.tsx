import { useState, useEffect } from 'react';
import { chatApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';

interface GroupDetailPanelProps {
  session: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function GroupDetailPanel({ session, isOpen, onClose }: GroupDetailPanelProps) {
  const { user } = useAuthStore();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState(session?.announcement || '');
  const [editingAnnouncement, setEditingAnnouncement] = useState(false);
  const [announcementText, setAnnouncementText] = useState(session?.announcement || '');
  const [inviteCode, setInviteCode] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const isAdmin = session?.members?.some(
    (m: any) => m.user.id === user?.id && (m.role === 'owner' || m.role === 'admin')
  );
  const isOwner = session?.ownerId === user?.id;

  useEffect(() => {
    if (isOpen && session?.id) {
      loadMembers();
    }
  }, [isOpen, session?.id]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const res: any = await chatApi.getSessionMembers(session.id);
      setMembers(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleSaveAnnouncement = async () => {
    try {
      await chatApi.setAnnouncement(session.id, announcementText);
      setAnnouncement(announcementText);
      setEditingAnnouncement(false);
    } catch { /* ignore */ }
  };

  const handleRemoveAnnouncement = async () => {
    try {
      await chatApi.removeAnnouncement(session.id);
      setAnnouncement('');
      setAnnouncementText('');
    } catch { /* ignore */ }
  };

  const handleGenerateInvite = async () => {
    try {
      const res: any = await chatApi.generateInviteLink(session.id);
      setInviteCode(res.data?.code || '');
    } catch { /* ignore */ }
  };

  const handleCopyInvite = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-[10vh]">
      <div className="bg-surface rounded-xl w-full max-w-lg shadow-xl border border-border max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold">{session?.name || 'Group Details'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-border rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Announcement */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              Announcement
            </h4>
            {editingAnnouncement ? (
              <div className="space-y-2">
                <textarea
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  className="input-field w-full text-sm resize-none"
                  rows={3}
                  placeholder="Write an announcement..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveAnnouncement} className="px-3 py-1 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                    Save
                  </button>
                  <button onClick={() => { setEditingAnnouncement(false); setAnnouncementText(announcement); }} className="px-3 py-1 text-sm bg-bg border border-border rounded-lg hover:bg-border">
                    Cancel
                  </button>
                  {announcement && (
                    <button onClick={handleRemoveAnnouncement} className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {announcement ? (
                  <p className="text-sm bg-bg rounded-lg p-3">{announcement}</p>
                ) : (
                  <p className="text-sm text-text-secondary italic">No announcement set</p>
                )}
                {isAdmin && (
                  <button onClick={() => setEditingAnnouncement(true)} className="text-xs text-primary-600 hover:underline">
                    {announcement ? 'Edit' : 'Add announcement'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Invite Link */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Invite Link
            </h4>
            {isAdmin ? (
              <div className="space-y-2">
                {inviteCode ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-bg rounded-lg px-3 py-2 font-mono truncate">{inviteCode}</code>
                    <button onClick={handleCopyInvite} className="px-3 py-1.5 text-sm bg-bg border border-border rounded-lg hover:bg-border transition-colors whitespace-nowrap">
                      {copySuccess ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                ) : (
                  <button onClick={handleGenerateInvite} className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                    Generate invite link
                  </button>
                )}
                <p className="text-xs text-text-secondary">Links expire after 7 days</p>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">Ask an admin for an invite link</p>
            )}
          </div>

          {/* Members */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              Members ({members.length})
            </h4>
            {loading ? (
              <p className="text-sm text-text-secondary">Loading...</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {members.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-border/50 transition-colors">
                    <img
                      src={m.user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${m.user.username}`}
                      alt={m.user.username}
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{m.user.nickname || m.user.username}</span>
                        {m.role === 'owner' && <span className="text-[10px] px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">Owner</span>}
                        {m.role === 'admin' && <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Admin</span>}
                      </div>
                      <p className="text-xs text-text-secondary">@{m.user.username}</p>
                    </div>
                    {m.user.status === 'online' && (
                      <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Backdrop click */}
      <div className="fixed inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
