import { useRef, useState, useCallback } from 'react';

interface FileUploadPanelProps {
  onUpload: (files: File[]) => void;
  disabled?: boolean;
}

interface UploadPreview {
  file: File;
  url: string;
  progress: number;
  uploading: boolean;
}

const ACCEPTED_TYPES = 'image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar';

export default function FileUploadPanel({ onUpload, disabled }: FileUploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [previews, setPreviews] = useState<UploadPreview[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const createPreviews = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newPreviews = fileArray.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      progress: 0,
      uploading: false,
    }));
    setPreviews((prev) => [...prev, ...newPreviews]);
  }, []);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    createPreviews(files);
  }, [createPreviews]);

  const removePreview = useCallback((index: number) => {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSend = useCallback(() => {
    if (previews.length === 0) return;
    const filesToUpload = previews.filter((p) => !p.uploading).map((p) => p.file);
    if (filesToUpload.length === 0) return;
    setPreviews((prev) => prev.map((p) => ({ ...p, uploading: true })));
    onUpload(filesToUpload);
    setPreviews([]);
  }, [previews, onUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📄';
    if (type.includes('zip') || type.includes('rar')) return '📦';
    return '📎';
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        className="hidden"
        data-testid="file-input"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />

      {/* Preview panel */}
      {previews.length > 0 && (
        <div className="p-3 border-t border-border bg-surface">
          <div className="flex flex-wrap gap-2 mb-2">
            {previews.map((preview, i) => (
              <div key={i} className="relative group">
                {preview.file.type.startsWith('image/') ? (
                  <div className="relative">
                    <img
                      src={preview.url}
                      alt=""
                      className="w-16 h-16 object-cover rounded-lg border border-border"
                    />
                    {preview.uploading && (
                      <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{preview.progress}%</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg border border-border bg-bg flex flex-col items-center justify-center text-[10px]">
                    <span className="text-lg">{getFileIcon(preview.file.type)}</span>
                    <span className="text-text-secondary truncate max-w-[56px]">{preview.file.name.split('.').pop()}</span>
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
              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              disabled={previews.every((p) => p.uploading)}
            >
              Send {previews.length} file{previews.length > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* Upload button + drop zone */}
      <div
        ref={dropRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative"
      >
        {dragOver && (
          <div className="absolute bottom-full left-0 right-0 mb-2 p-4 bg-primary-50 dark:bg-primary-900/30 border-2 border-dashed border-primary-400 rounded-lg text-center text-sm text-primary-700 dark:text-primary-300">
            Drop files to attach
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
      </div>
    </>
  );
}
