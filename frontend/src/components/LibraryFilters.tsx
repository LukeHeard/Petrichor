"use client";

import { useState, useRef, useEffect } from "react";

interface LibraryFiltersProps {
  onSearchChange: (query: string) => void;
  onStatusChange: (statuses: string[]) => void;
  onTagChange: (tags: string[]) => void;
  onSortChange: (sortBy: string) => void;
  onViewModeChange: (mode: 'list' | 'grid') => void;
  onReset: () => void;
  viewMode: 'list' | 'grid';
  allTags: string[];
  searchQuery: string;
  selectedStatuses: string[];
  selectedTags: string[];
  sortBy: string;
  isInitialized: boolean;
}

export default function LibraryFilters({ 
  onSearchChange,
  onStatusChange,
  onTagChange,
  onSortChange,
  onViewModeChange,
  onReset,
  viewMode,
  allTags,
  searchQuery,
  selectedStatuses: parentSelectedStatuses,
  selectedTags: parentSelectedTags,
  sortBy: parentSortBy,
  isInitialized
}: LibraryFiltersProps) {
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const statuses = ["Owned", "Reading", "Finished", "DNF"];

  const sortOptions = [
    { label: "Recently Added", value: "added-desc" },
    { label: "Oldest Added", value: "added-asc" },
    { label: "Title (A-Z)", value: "title-asc" },
    { label: "Title (Z-A)", value: "title-desc" },
    { label: "Author (A-Z)", value: "author-asc" },
    { label: "Author (Z-A)", value: "author-desc" },
    { label: "Rating (High-Low)", value: "rating-desc" },
    { label: "Rating (Low-High)", value: "rating-asc" },
    { label: "Year (Newest)", value: "year-desc" },
    { label: "Year (Oldest)", value: "year-asc" },
  ];

  const currentSortLabel = sortOptions.find(o => o.value === parentSortBy)?.label || "Sort";

  const handleStatusToggle = (status: string) => {
    const newStatuses = parentSelectedStatuses.includes(status)
      ? parentSelectedStatuses.filter(s => s !== status)
      : [...parentSelectedStatuses, status];
    onStatusChange(newStatuses);
  };

  const handleTagToggle = (tag: string) => {
    const newTags = parentSelectedTags.includes(tag)
      ? parentSelectedTags.filter(t => t !== tag)
      : [...parentSelectedTags, tag];
    onTagChange(newTags);
  };
  
  const [canReset, setCanReset] = useState(false);

  useEffect(() => {
    setCanReset(isInitialized && (searchQuery !== "" || parentSelectedStatuses.length > 0 || parentSelectedTags.length > 0 || parentSortBy !== "added-desc"));
  }, [isInitialized, searchQuery, parentSelectedStatuses, parentSelectedTags, parentSortBy]);

  // Mount check
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Close sort dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="fade-in-up" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '1.25rem', 
      marginBottom: '2rem',
      position: 'relative',
      zIndex: 100 // Ensure filters stay on top of the list below
    }}>
      
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
            value={searchQuery}
            onChange={(e) => {
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

        {/* Custom Sleek Sort Dropdown */}
        <div ref={sortRef} style={{ position: 'relative' }}>
          <button 
            onClick={() => setIsSortOpen(!isSortOpen)}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.75rem 0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--muted)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'color 0.2s ease',
              fontFamily: 'var(--font-sans)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}
          >
          {currentSortLabel}
            <svg 
              style={{ transform: isSortOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>

          {isSortOpen && (
            <div style={{
              position: 'absolute',
              top: '110%',
              right: 0,
              width: '200px',
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '0.5rem',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              zIndex: 200, // Higher than the main container
              display: 'flex',
              flexDirection: 'column',
              gap: '0.1rem',
              animation: 'menuSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              pointerEvents: 'auto',
              userSelect: 'none'
            }}>
              {sortOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => {
                    onSortChange(option.value);
                    setIsSortOpen(false);
                  }}
                  style={{
                    padding: '0.6rem 0.75rem',
                    textAlign: 'left',
                    background: parentSortBy === option.value ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: parentSortBy === option.value ? 'var(--accent)' : 'var(--foreground)',
                    fontSize: '0.8rem',
                    fontWeight: parentSortBy === option.value ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  className="sort-option-hover"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* View Toggle and Reset Button Wrapper */}
        <div style={{ 
          marginLeft: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'flex-end',
          position: 'relative'
        }}>
          {/* View Toggle */}
          <div style={{ 
            display: 'flex', 
            background: 'var(--muted-background)', 
            padding: '0.2rem', 
            borderRadius: '8px'
          }}>
            <button
              onClick={() => onViewModeChange('list')}
              style={{
                padding: '0.4rem 0.6rem',
                border: 'none',
                background: viewMode === 'list' ? 'var(--background)' : 'transparent',
                color: viewMode === 'list' ? 'var(--accent)' : 'var(--muted)',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                boxShadow: viewMode === 'list' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.2s ease'
              }}
              title="List View"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
            <button
              onClick={() => onViewModeChange('grid')}
              style={{
                padding: '0.4rem 0.6rem',
                border: 'none',
                background: viewMode === 'grid' ? 'var(--background)' : 'transparent',
                color: viewMode === 'grid' ? 'var(--accent)' : 'var(--muted)',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                boxShadow: viewMode === 'grid' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.2s ease'
              }}
              title="Grid View"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
            </button>
          </div>

          {/* Reset Button - Positioned absolutely below to not disrupt toggle alignment */}
          <div style={{ 
            position: 'absolute',
            top: 'calc(100% + 0.4rem)',
            right: 0,
            whiteSpace: 'nowrap'
          }}>
            <button
              onClick={onReset}
              disabled={!isMounted || !canReset}
              style={{
                background: 'none',
                border: 'none',
                padding: '0.25rem 0.5rem',
                color: (isMounted && canReset) ? 'var(--accent)' : 'var(--muted)',
                fontSize: '0.65rem',
                fontWeight: 800,
                cursor: (isMounted && canReset) ? 'pointer' : 'default',
                fontFamily: 'var(--font-sans)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                opacity: (isMounted && canReset) ? 0.7 : 0.3,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (canReset) e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                if (canReset) e.currentTarget.style.opacity = '0.7';
              }}
            >
              Reset Filters
            </button>
          </div>
        </div>
    </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .sort-option-hover:hover {
          background: color-mix(in srgb, var(--muted) 10%, transparent) !important;
          padding-left: 1rem !important;
        }
      `}} />

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
              borderColor: parentSelectedStatuses.includes(status) ? 'var(--accent)' : 'var(--border)',
              background: parentSelectedStatuses.includes(status) ? 'var(--accent)' : 'transparent',
              color: parentSelectedStatuses.includes(status) ? 'var(--accent-foreground)' : 'var(--muted)',
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
                    borderColor: parentSelectedTags.includes(tag) ? 'var(--accent)' : 'transparent',
                    background: parentSelectedTags.includes(tag) ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--muted-background)',
                    color: parentSelectedTags.includes(tag) ? 'var(--accent)' : 'var(--muted)',
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
