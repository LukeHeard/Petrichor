"use client";

import { useEffect, useState, useCallback, Suspense, useMemo } from "react";
import LibraryItem from "@/components/LibraryItem";
import LibraryFilters from "@/components/LibraryFilters";

interface Work {
  id: number;
  title: string;
  goodreads_id?: string;
  thumbnail_url?: string;
  author?: string;
  first_publish_year?: number;
  tags?: string[];
  personal_rating?: number;
  status?: string;
  created_at?: number;
}

function LibraryContent() {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSpinner, setShowSpinner] = useState(false);

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("id-desc");

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setTimeout(() => setShowSpinner(true), 1000);
    } else {
      setShowSpinner(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const fetchWorks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works`);
      if (response.ok) {
        const data = await response.json();
        setWorks(data);
      }
    } catch (err) {
      console.error("Failed to fetch works", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorks();

    const handleWorkAdded = () => {
      fetchWorks();
    };

    const handleWorkUpdated = (e: any) => {
      const { id, ...updates } = e.detail;
      setWorks(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
    };

    window.addEventListener("petrichor:workAdded", handleWorkAdded);
    window.addEventListener("petrichor:workUpdated", handleWorkUpdated as EventListener);
    return () => {
      window.removeEventListener("petrichor:workAdded", handleWorkAdded);
      window.removeEventListener("petrichor:workUpdated", handleWorkUpdated as EventListener);
    }
  }, [fetchWorks]);

  // Dynamically compute available tags from current works
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    works.forEach(w => w.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [works]);

  const filteredAndSortedWorks = useMemo(() => {
    let result = [...works];

    // Search Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(w => 
        w.title.toLowerCase().includes(q) || 
        (w.author && w.author.toLowerCase().includes(q))
      );
    }

    // Status Filter
    if (selectedStatuses.length > 0) {
      result = result.filter(w => w.status && selectedStatuses.includes(w.status));
    }

    // Tags Filter
    if (selectedTags.length > 0) {
      result = result.filter(w => w.tags && w.tags.some(t => selectedTags.includes(t)));
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'added-desc':
          return (b.created_at || 0) - (a.created_at || 0);
        case 'added-asc':
          return (a.created_at || 0) - (b.created_at || 0);
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        case 'author-asc':
          return (a.author || "").localeCompare(b.author || "");
        case 'author-desc':
          return (b.author || "").localeCompare(a.author || "");
        case 'rating-desc':
          return (b.personal_rating || 0) - (a.personal_rating || 0);
        case 'rating-asc':
          return (a.personal_rating || 0) - (b.personal_rating || 0);
        case 'year-desc':
          return (b.first_publish_year || 0) - (a.first_publish_year || 0);
        case 'year-asc':
          return (a.first_publish_year || 0) - (b.first_publish_year || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [works, searchQuery, selectedStatuses, selectedTags, sortBy]);

  return (
    <div>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ marginBottom: '0.25rem' }}>Petrichor <span style={{ opacity: 0.5, fontWeight: 400 }}>Library</span></h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', letterSpacing: '0.02em' }}>"A reader lives a thousand lives before he dies. The man who never reads lives only one." — George R.R. Martin</p>
      </header>

      <section>
        <LibraryFilters 
          onSearchChange={setSearchQuery}
          onStatusChange={setSelectedStatuses}
          onTagChange={setSelectedTags}
          onSortChange={setSortBy}
          allTags={allTags}
        />

        {loading ? (
          showSpinner && (
            <p style={{ textAlign: 'center', margin: '3rem 0', color: 'var(--muted)', fontStyle: 'italic' }}>Loading library...</p>
          )
        ) : filteredAndSortedWorks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <p style={{ color: 'var(--muted)', fontStyle: 'italic' }}>No books matching your filters.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {filteredAndSortedWorks.map((work, index) => (
              <LibraryItem 
                key={work.id}
                id={work.id}
                index={index}
                title={work.title}
                author={work.author}
                first_publish_year={work.first_publish_year}
                personal_rating={work.personal_rating}
                status={work.status}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function Library() {
  return (
    <Suspense fallback={null}>
      <LibraryContent />
    </Suspense>
  );
}
