import { useState, useMemo, useEffect, useRef, useCallback } from 'react';

const EMOJI_CATEGORIES = [
  {
    name: 'Frequently Used',
    emojis: ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '✨', '🎉', '💯', '✅', '❌'],
  },
  {
    name: 'Smileys',
    emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤔', '🤐', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮', '😯', '😲', '😳', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽'],
  },
  {
    name: 'Gestures',
    emojis: ['👋', '🤚', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦵'],
  },
  {
    name: 'Hearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️'],
  },
  {
    name: 'Nature',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍'],
  },
  {
    name: 'Food',
    emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🫘', '🥐', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯'],
  },
  {
    name: 'Objects',
    emojis: ['🎉', '🎊', '🎈', '🎁', '🎀', '🪄', '🕯️', '💡', '🔦', '🏮', '📖', '📕', '📗', '📘', '📙', '📚', '📓', '📔', '📒', '📃', '📜', '📄', '📰', '🗞️', '📑', '🔖', '🏷️', '💰', '💴', '💵', '💶', '💷', '💸', '💳', '🧾', '✉️', '📧', '📨', '📩', '📤', '📥', '📦', '📫', '📪', '📬', '📭', '📮', '📝', '📎', '🖇️', '📁', '📂', '🗂️'],
  },
  {
    name: 'Symbols',
    emojis: ['✅', '❌', '❓', '❔', '❕', '❗', '‼️', '⁉️', '➕', '➖', '➗', '✖️', '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '♻️', '⚜️', '🔰', '✅', '❌'],
  },
];

const RECENT_KEY = 'emoji-picker-recent';

function getRecentEmojis(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveRecentEmojis(emojis: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(emojis.slice(0, 24)));
  } catch { /* ignore */ }
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(0);
  const [recent, setRecent] = useState<string[]>(getRecentEmojis());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleSelect = useCallback((emoji: string) => {
    const updated = [emoji, ...recent.filter((e) => e !== emoji)];
    setRecent(updated);
    saveRecentEmojis(updated);
    onSelect(emoji);
    onClose();
  }, [recent, onSelect, onClose]);

  const filteredEmojis = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const results: { emoji: string; cat: string }[] = [];
    for (const cat of EMOJI_CATEGORIES) {
      for (const emoji of cat.emojis) {
        if (emoji.includes(q)) {
          results.push({ emoji, cat: cat.name });
        }
      }
    }
    return results;
  }, [search]);

  const allEmojis = useMemo(() => {
    return EMOJI_CATEGORIES.flatMap((c) => c.emojis);
  }, []);

  return (
    <div
      ref={ref}
      className="bg-surface border border-border rounded-xl shadow-2xl w-[340px] overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search */}
      <div className="p-2 border-b border-border">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search emoji..."
          className="input-field w-full text-sm"
          autoFocus
        />
      </div>

      {/* Categories tabs */}
      {!search.trim() && (
        <div className="flex gap-0.5 px-2 py-1.5 border-b border-border overflow-x-auto">
          <button
            onClick={() => setCategory(-1)}
            className={`px-2 py-1 text-[10px] rounded whitespace-nowrap transition-colors ${category === -1 ? 'bg-primary-100 text-primary-700' : 'hover:bg-border text-text-secondary'}`}
          >
            All
          </button>
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.name}
              onClick={() => setCategory(i)}
              className={`px-2 py-1 text-[10px] rounded whitespace-nowrap transition-colors ${category === i ? 'bg-primary-100 text-primary-700' : 'hover:bg-border text-text-secondary'}`}
            >
              {cat.emojis[0]} {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="max-h-[260px] overflow-y-auto p-2">
        {search.trim() ? (
          <div className="grid grid-cols-8 gap-0.5">
            {filteredEmojis && filteredEmojis.length > 0 ? (
              filteredEmojis.map(({ emoji }, i) => (
                <button
                  key={`${emoji}-${i}`}
                  onClick={() => handleSelect(emoji)}
                  className="w-9 h-9 flex items-center justify-center text-lg hover:bg-border rounded transition-colors"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))
            ) : (
              <p className="col-span-8 text-center text-sm text-text-secondary py-4">No emoji found</p>
            )}
          </div>
        ) : category === -1 ? (
          <div className="space-y-3">
            {recent.length > 0 && (
              <div>
                <p className="text-[10px] text-text-secondary mb-1 font-medium">RECENT</p>
                <div className="grid grid-cols-8 gap-0.5">
                  {recent.map((emoji, i) => (
                    <button
                      key={`recent-${i}`}
                      onClick={() => handleSelect(emoji)}
                      className="w-9 h-9 flex items-center justify-center text-lg hover:bg-border rounded transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-[10px] text-text-secondary mb-1 font-medium">ALL</p>
              <div className="grid grid-cols-8 gap-0.5">
                {allEmojis.map((emoji, i) => (
                  <button
                    key={`all-${i}`}
                    onClick={() => handleSelect(emoji)}
                    className="w-9 h-9 flex items-center justify-center text-lg hover:bg-border rounded transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-0.5">
            {EMOJI_CATEGORIES[category]?.emojis.map((emoji, i) => (
              <button
                key={`${category}-${i}`}
                onClick={() => handleSelect(emoji)}
                className="w-9 h-9 flex items-center justify-center text-lg hover:bg-border rounded transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { EMOJI_CATEGORIES };
