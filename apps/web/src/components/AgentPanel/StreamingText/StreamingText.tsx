import { useState, useEffect, useRef, useCallback } from 'react';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

interface StreamingTextProps {
  content: string;
  className?: string;
  typingSpeed?: number;
  isStreaming?: boolean;
}

export default function StreamingText({
  content,
  className = '',
  typingSpeed = 8,
  isStreaming = false,
}: StreamingTextProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const contentRef = useRef(content);
  const typingRef = useRef<number | null>(null);
  const speedRef = useRef(typingSpeed);
  const displayedLenRef = useRef(0);

  useEffect(() => {
    speedRef.current = typingSpeed;
  }, [typingSpeed]);

  useEffect(() => {
    contentRef.current = content;
    if (!isStreaming) {
      // When streaming ends, show full content immediately (no typewriter needed)
      displayedLenRef.current = content.length;
      setDisplayedContent(content);
    }
  }, [content, isStreaming]);

  const typeChar = useCallback(() => {
    const target = contentRef.current;
    const prevLen = displayedLenRef.current;
    if (prevLen < target.length) {
      const next = target.slice(0, prevLen + 1);
      displayedLenRef.current = next.length;
      setDisplayedContent(next);
      const delay = speedRef.current;
      typingRef.current = window.setTimeout(typeChar, delay) as unknown as number;
    } else {
      setIsTyping(false);
    }
  }, []);

  useEffect(() => {
    const target = contentRef.current;
    if (!target) return;

    if (typingRef.current) {
      clearTimeout(typingRef.current as unknown as number);
      typingRef.current = null;
    }

    if (isStreaming && target.length > displayedLenRef.current) {
      setIsTyping(true);
      const delay = speedRef.current;
      typingRef.current = window.setTimeout(typeChar, delay) as unknown as number;
    } else if (!isStreaming) {
      // Streaming ended — show full content immediately
      displayedLenRef.current = target.length;
      setDisplayedContent(target);
      setIsTyping(false);
    }

    return () => {
      if (typingRef.current) {
        clearTimeout(typingRef.current as unknown as number);
        typingRef.current = null;
      }
    };
    // NOTE: do NOT add displayedContent.length to deps — it causes an infinite render loop
     
  }, [content, isStreaming, typeChar]);

  if (!displayedContent) return null;

  const html = md.render(displayedContent);

  return (
    <div className={`${className} prose prose-sm dark:prose-invert max-w-none`}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {isStreaming && isTyping && (
        <span className="inline-block w-2 h-4 bg-primary-500 animate-pulse ml-0.5 align-middle" />
      )}
    </div>
  );
}
