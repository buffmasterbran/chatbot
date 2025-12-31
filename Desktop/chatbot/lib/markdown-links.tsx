import React from 'react';

/**
 * Converts markdown links [text](url) to clickable HTML links
 * Returns an array of React nodes that can be rendered directly
 */
export function parseMarkdownLinks(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let keyCounter = 0;
  
  // Pattern for markdown links: [text](url)
  const markdownLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = markdownLinkPattern.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    
    // Add the link with very obvious link styling - blue and underlined
    const linkText = match[1];
    const linkUrl = match[2];
    parts.push(
      <a
        key={`link-${keyCounter++}`}
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="chat-link"
        style={{
          color: '#2563eb',
          textDecoration: 'underline',
          textDecorationColor: '#2563eb',
          textUnderlineOffset: '2px',
          fontWeight: '500',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.setProperty('color', '#1e40af', 'important');
          e.currentTarget.style.setProperty('text-decoration-color', '#1e40af', 'important');
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.setProperty('color', '#2563eb', 'important');
          e.currentTarget.style.setProperty('text-decoration-color', '#2563eb', 'important');
        }}
      >
        {linkText}
      </a>
    );
    
    lastIndex = markdownLinkPattern.lastIndex;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  // If no markdown links were found, return the original text
  if (parts.length === 0) {
    return text;
  }
  
  // Return fragments if multiple parts, or single element if one part
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

