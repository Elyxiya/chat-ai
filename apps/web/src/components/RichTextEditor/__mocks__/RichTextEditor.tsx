import React from 'react';

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  return (
    <textarea
      data-testid="rich-text-editor"
      placeholder={placeholder || ''}
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}
