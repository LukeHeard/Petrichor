"use client";

import { useState, useEffect } from "react";

interface LibraryFiltersProps {
  onSearchChange: (query: string) => void;
  onStatusChange: (statuses: string[]) => void;
  onTagChange: (tags: string[]) => void;
  onSortChange: (sortBy: string) => void;
  allTags: string[];
}

export default function LibraryFilters({ 
  onSearchChange, 
  onStatusChange, 
  onTagChange, 
  onSortChange,
  allTags
}: LibraryFiltersProps) {
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("id-desc"); // Default: Recently Added
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);

  const statuses = ["Owned", "Reading", "Finished", "DNF"];

  const handleStatusToggle = (status: string) => {
    const newStatuses = selectedStatuses.includes(status)
      ? selectedStatuses.filter(s => s !== status)
      : [...selectedStatuses, status];
    setSelectedStatuses(newStatuses);
    onStatusChange(newStatuses);
  };

  const handleTagToggle = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(newTags);
    onTagChange(newTags);
  };

  return (
    <div className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
      
      {/* Search and Sort Row */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <svg 
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', opacity: 0.6 }}
            xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input 
            type="text"
            placeholder="Search title or author..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              onSearchChange(e.target.value);
            }}
            style={{
              width: '100%',
              padding: '0.75rem 1rem 0.75rem 2.5rem',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'var(--muted-background)',
              color: 'var(--foreground)',
              fontSize: '0.9rem',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
              transition: 'all 0.2s ease'
            }}
          />
        </div>

        <div style={{ position: 'relative', minWidth: '160px' }}>
          <select 
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              onSortChange(e.target.value);
            }}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'var(--muted-background)',
              color: 'var(--foreground)',
              fontSize: '0.9rem',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
              appearance: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="id-desc">Recently Added</option>
            <option value="title-asc">Title (A-Z)</option>
            <option value="author-asc">Author (A-Z)</option>
            <option value="rating-desc">Rating (High-Low)</option>
            <option value="year-desc">Release Year (Newest)</option>
          </select>
          <svg 
            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}
            xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
      </div>

      {/* Status Filter */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {statuses.map(status => (
          <button
            key={status}
            onClick={() => handleStatusToggle(status)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '20px',
              border: '1px solid',
              borderColor: selectedStatuses.includes(status) ? 'var(--accent)' : 'var(--border)',
              background: selectedStatuses.includes(status) ? 'var(--accent)' : 'transparent',
              color: selectedStatuses.includes(status) ? 'var(--accent-foreground)' : 'var(--muted)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'var(--font-sans)',
              letterSpacing: '0.02em'
            }}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Tag Filter */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button 
            onClick={() => setIsTagsExpanded(!isTagsExpanded)}
            style={{
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--muted)',
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              padding: 0,
              width: 'fit-content'
            }}
          >
            Filter by Tags 
            <svg 
              style={{ transform: isTagsExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>

          {isTagsExpanded && (
            <div style={{ 
              display: 'flex', 
              gap: '0.4rem', 
              flexWrap: 'wrap', 
              maxHeight: '120px', 
              overflowY: 'auto',
              padding: '0.1rem'
            }}>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: selectedTags.includes(tag) ? 'var(--accent)' : 'transparent',
                    background: selectedTags.includes(tag) ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--muted-background)',
                    color: selectedTags.includes(tag) ? 'var(--accent)' : 'var(--muted)',
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
