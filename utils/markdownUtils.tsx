import React from 'react';

// Helper to format inline markdown (bold, italic, code)
export const formatInlineMarkdown = (text: string): React.ReactNode => {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  // Pattern for **bold**, *italic*, `code`, and **bold with *italic***
  const patterns = [
    { regex: /\*\*([^*]+)\*\*/g, tag: 'strong', className: 'font-semibold' },
    { regex: /\*([^*]+)\*/g, tag: 'em', className: 'italic' },
    { regex: /`([^`]+)`/g, tag: 'code', className: 'bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono' },
  ];
  
  // Find all matches
  const matches: Array<{ start: number; end: number; type: string; content: string; className: string }> = [];
  
  patterns.forEach(({ regex, tag, className }) => {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        type: tag,
        content: match[1],
        className
      });
    }
  });
  
  // Sort matches by position
  matches.sort((a, b) => a.start - b.start);
  
  // Remove overlapping matches (keep the first one)
  const filteredMatches: typeof matches = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const overlaps = filteredMatches.some(m => 
      (match.start >= m.start && match.start < m.end) ||
      (match.end > m.start && match.end <= m.end)
    );
    if (!overlaps) {
      filteredMatches.push(match);
    }
  }
  
  // Build React elements
  filteredMatches.forEach((match, idx) => {
    // Add text before match
    if (match.start > lastIndex) {
      parts.push(text.substring(lastIndex, match.start));
    }
    
    // Add formatted content
    const Tag = match.type as keyof JSX.IntrinsicElements;
    parts.push(
      <Tag key={idx} className={match.className}>
        {match.content}
      </Tag>
    );
    
    lastIndex = match.end;
  });
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? <>{parts}</> : text;
};

export const formatMarkdown = (text: string): React.ReactNode => {
  if (!text) return null;
  
  // Split by double newlines to create paragraphs
  const paragraphs = text.split(/\n\n+/);
  
  return paragraphs.map((para, paraIdx) => {
    if (!para.trim()) return null;
    
    // Split by single newlines for line breaks
    const lines = para.split('\n');
    
    return (
      <div key={paraIdx} className={paraIdx > 0 ? 'mt-3' : ''}>
        {lines.map((line, lineIdx) => {
          if (!line.trim()) return <br key={lineIdx} />;
          
          // Check if it's a list item
          const listMatch = line.match(/^(\s*)([-*•]\s+|(\d+\.)\s+)(.+)$/);
          if (listMatch) {
            const isOrdered = !!listMatch[3];
            const content = formatInlineMarkdown(listMatch[4]);
            return (
              <div key={lineIdx} className={`flex ${lineIdx > 0 ? 'mt-1' : ''}`}>
                <span className="mr-2">{isOrdered ? listMatch[3] : '•'}</span>
                <span>{content}</span>
              </div>
            );
          }
          
          // Check if it's a heading
          const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
          if (headingMatch) {
            const level = headingMatch[1].length;
            const content = formatInlineMarkdown(headingMatch[2]);
            const Tag = `h${level}` as keyof JSX.IntrinsicElements;
            const className = level === 1 ? 'text-lg font-bold mt-4 mb-2' : 
                             level === 2 ? 'text-base font-semibold mt-3 mb-1' : 
                             'text-sm font-semibold mt-2 mb-1';
            return <Tag key={lineIdx} className={className}>{content}</Tag>;
          }
          
          // Regular paragraph line
          return (
            <p key={lineIdx} className={lineIdx > 0 ? 'mt-2' : ''}>
              {formatInlineMarkdown(line)}
            </p>
          );
        })}
      </div>
    );
  });
};




