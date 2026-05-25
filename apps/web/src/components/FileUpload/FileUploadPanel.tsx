import { useRef, useState } from 'react';

interface FileUploadPanelProps {
  onUpload: (files: File[]) => void;
  disabled?: boolean;
}

export default function FileUploadPanel({ onUpload, disabled }: FileUploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);

    const newPreviews = fileArray.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removePreview = (index: number) => {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSend = () => {
    if (previews.length === 0) return;
    onUpload(previews.map((p) => p.file));
    setPreviews([]);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
        className="hidden"
        data-testid="file-input"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />

      {previews.length > 0 && (
        <div className="p-3 border-t border-border bg-surface">
          <div className="flex flex-wrap gap-2 mb-2">
            {previews.map((preview, i) => (
              <div key={i} className="relative group">
                {preview.file.type.startsWith('image/') ? (
                  <img
                    src={preview.url}
                    alt=""
                    className="w-16 h-16 object-cover rounded-lg border border-border"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg border border-border bg-bg flex items-center justify-center">
                    <svg className="w-6 h-6 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <button
                  onClick={() => removePreview(i)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  x
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-sm bg-bg border border-border rounded-lg hover:bg-border transition-colors"
            >
              Add more
            </button>
            <button
              onClick={handleSend}
              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Send {previews.length} file{previews.length > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="p-2 hover:bg-border rounded-lg transition-colors disabled:opacity-50"
        title="Attach files"
      >
        <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      </button>
    </>
  );
}
