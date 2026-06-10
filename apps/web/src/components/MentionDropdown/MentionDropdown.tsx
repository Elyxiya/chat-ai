import { useEffect, useRef } from 'react';

interface MentionUser {
  id: string;
  username: string;
  nickname?: string | null;
  avatarUrl?: string | null;
}

interface MentionDropdownProps {
  isOpen: boolean;
  query: string;
  members: MentionUser[];
  position: { top: number; left: number };
  selectedIndex: number;
  onSelect: (user: MentionUser) => void;
  onClose: () => void;
  onSelectedIndexChange: (index: number) => void;
}

export default function MentionDropdown({
  isOpen,
  query,
  members,
  position,
  selectedIndex,
  onSelect,
  onClose,
  onSelectedIndexChange,
}: MentionDropdownProps) {
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = query
    ? members.filter((m) => {
        const q = query.toLowerCase();
        return (
          m.username.toLowerCase().includes(q) ||
          (m.nickname && m.nickname.toLowerCase().includes(q))
        );
      })
    : members;

  // Reset selection when filtered list changes
  useEffect(() => {
    onSelectedIndexChange(0);
  }, [query, members.length, onSelectedIndexChange]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current || !isOpen) return;
    const item = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, isOpen]);

  if (!isOpen || filtered.length === 0) return null;

  return (
    <div
      className="fixed z-50"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="bg-surface border border-border rounded-lg shadow-xl overflow-hidden min-w-[180px] max-w-[260px] max-h-[240px] flex flex-col">
        <div className="px-3 py-1.5 text-[11px] font-medium text-text-secondary bg-bg/50 border-b border-border">
          Members
        </div>
        <ul ref={listRef} className="overflow-y-auto flex-1 py-1">
          {filtered.map((user, idx) => (
            <li key={user.id}>
              <button
                type="button"
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors ${
                  idx === selectedIndex
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'hover:bg-bg text-text'
                }`}
                onMouseEnter={() => onSelectedIndexChange(idx)}
                onClick={() => onSelect(user)}
              >
                <img
                  src={
                    user.avatarUrl ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${user.username}`
                  }
                  alt={user.username}
                  className="w-6 h-6 rounded-full flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="font-medium truncate block">
                    {user.nickname || user.username}
                  </span>
                </div>
                <span className="text-text-secondary text-xs flex-shrink-0">
                  @{user.username}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
