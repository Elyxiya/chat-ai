import { useMemo } from 'react';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

interface StreamingTextProps {
  content: string;
  className?: string;
}

export default function StreamingText({ content, className = '' }: StreamingTextProps) {
  const html = useMemo(() => {
    if (!content) return '';
    return md.render(content);
  }, [content]);

  if (!content) return null;

  return (
    <div
      className={`${className} prose prose-sm dark:prose-invert max-w-none`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
