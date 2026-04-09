"use client";

import { useState, useEffect, useRef } from "react";

interface TagManagerProps {
  tags: string[];
  onTagsChange: (newTags: string[]) => void;
}

export default function TagManager({ tags, onTagsChange }: TagManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [filteredTags, setFilteredTags] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isModalOpen) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/tags`)
        .then(res => res.json())
        .then(data => setAllTags(data))
        .catch(err => console.error("Failed to fetch tags", err));
      
      // Focus input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (inputValue.trim() === "") {
      setFilteredTags([]);
    } else {
      const filtered = allTags.filter(t => 
        t.toLowerCase().includes(inputValue.toLowerCase()) && !tags.includes(t)
      ).slice(0, 5);
      setFilteredTags(filtered);
    }
    setHighlightedIndex(0);
  }, [inputValue, allTags, tags]);

  const addTag = (tag: string) => {
    const cleanTag = tag.trim();
    if (cleanTag && !tags.includes(cleanTag)) {
      onTagsChange([...tags, cleanTag]);
    }
    setInputValue("");
    setIsModalOpen(false);
  };

  const removeTag = (tag: string) => {
    onTagsChange(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      setHighlightedIndex(prev => Math.min(prev + 1, filteredTags.length - 1));
    } else if (e.key === "ArrowUp") {
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredTags.length > 0 && highlightedIndex >= 0) {
        addTag(filteredTags[highlightedIndex]);
      } else {
        addTag(inputValue);
      }
    } else if (e.key === "Escape") {
      setIsModalOpen(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
      {tags.map(tag => (
        <span key={tag} style={{
          fontSize: '0.7rem',
          padding: '0.2rem 0.6rem',
          backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          color: 'var(--accent)',
          borderRadius: '100px',
          fontWeight: 600,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem'
        }}>
          {tag}
          <button 
            onClick={() => removeTag(tag)}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--accent)', 
              cursor: 'pointer', 
              padding: 0, 
              fontSize: '1rem', 
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              opacity: 0.6,
              transform: 'translateY(-1px)'
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
          >
            &times;
          </button>
        </span>
      ))}
      
      <button 
        onClick={() => setIsModalOpen(true)}
        style={{
          fontSize: '0.7rem',
          padding: '0.2rem 0.6rem',
          backgroundColor: 'transparent',
          color: 'var(--muted)',
          borderRadius: '100px',
          fontWeight: 600,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.color = 'var(--accent)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--muted)';
        }}
        title="Add Tag"
      >
        +
      </button>

      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.2)',
          backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 4000
        }} onClick={() => setIsModalOpen(false)}>
          <div 
            style={{
              backgroundColor: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '1.5rem',
              width: '100%',
              maxWidth: '320px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              animation: 'fadeInUp 0.2s ease'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', fontWeight: 700 }}>Add Tag</h3>
            
            <div style={{ position: 'relative' }}>
              <input 
                ref={inputRef}
                type="text" 
                placeholder="Type tag name..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  border: '1px solid var(--accent)',
                  background: 'transparent',
                  color: 'var(--foreground)',
                  outline: 'none',
                  fontSize: '0.9rem'
                }}
              />
              
              {filteredTags.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  marginTop: '0.25rem',
                  overflow: 'hidden',
                  zIndex: 10,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                  {filteredTags.map((tag, i) => (
                    <div 
                      key={tag}
                      onClick={() => addTag(tag)}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        backgroundColor: i === highlightedIndex ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                        color: i === highlightedIndex ? 'var(--accent)' : 'var(--foreground)'
                      }}
                    >
                      {tag}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="btn-ghost"
                style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => addTag(inputValue)}
                className="btn-primary"
                style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem' }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
