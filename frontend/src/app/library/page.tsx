"use client";

import { useEffect, useState, useCallback, Suspense, useMemo } from "react";
import LibraryItem from "@/components/LibraryItem";
import BookCard from "@/components/BookCard";
import LibraryFilters from "@/components/LibraryFilters";

interface Work {
  id: number;
  title: string;
  goodreads_id?: string;
  thumbnail_url?: string;
  author?: string;
  series?: string;
  first_publish_year?: number;
  tags?: string[];
  personal_rating?: number;
  status?: string;
  page_count?: number;
  current_page?: number;
  created_at?: number;
}

// Module-level (not component state) so it survives the page unmounting on route
// navigation - returning to the library shows the last-known list instantly instead
// of flashing back to an empty/loading grid while it refetches in the background.
let cachedWorks: Work[] | null = null;

export const MIN_GRID_COLUMNS = 2;
export const MAX_GRID_COLUMNS = 6;
const DEFAULT_GRID_COLUMNS = 4;

const clampColumns = (value: number) => Math.min(MAX_GRID_COLUMNS, Math.max(MIN_GRID_COLUMNS, value));

// Caps how many columns actually render on narrow screens so a user's saved
// preference (e.g. 6 columns, picked on a desktop) can't shrink cards into
// unusable slivers on a phone - the preference itself is untouched and simply
// re-applies once the viewport is wide enough again.
function useViewportColumnCap() {
  const [cap, setCap] = useState(MAX_GRID_COLUMNS);

  useEffect(() => {
    const computeCap = () => {
      const width = window.innerWidth;
      if (width <= 480) return 2;
      if (width <= 768) return 3;
      return MAX_GRID_COLUMNS;
    };
    const update = () => setCap(computeCap());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return cap;
}

function LibraryContent() {
  const [works, setWorks] = useState<Work[]>(cachedWorks || []);
  const [loading, setLoading] = useState(!cachedWorks);
  const [showSpinner, setShowSpinner] = useState(false);

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("added-desc");
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [groupBySeries, setGroupBySeries] = useState(false);
  const [gridColumns, setGridColumns] = useState(DEFAULT_GRID_COLUMNS);
  const [isInitialized, setIsInitialized] = useState(false);

  const viewportColumnCap = useViewportColumnCap();
  const effectiveGridColumns = Math.min(gridColumns, viewportColumnCap);

  // Persistence: Load settings on mount
  useEffect(() => {
    const saved = localStorage.getItem("petrichor_library_settings");
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        if (settings.searchQuery !== undefined) setSearchQuery(settings.searchQuery);
        if (settings.selectedStatuses !== undefined) setSelectedStatuses(settings.selectedStatuses);
        if (settings.selectedTags !== undefined) setSelectedTags(settings.selectedTags);
        if (settings.sortBy !== undefined) setSortBy(settings.sortBy);
        if (settings.viewMode !== undefined) setViewMode(settings.viewMode);
        if (settings.groupBySeries !== undefined) setGroupBySeries(settings.groupBySeries);
        if (settings.gridColumns !== undefined) setGridColumns(clampColumns(settings.gridColumns));
      } catch (err) {
        console.error("Failed to parse saved settings", err);
      }
    }
    setIsInitialized(true);
  }, []);

  // Persistence: Save settings on change
  useEffect(() => {
    if (!isInitialized) return;
    const settings = { searchQuery, selectedStatuses, selectedTags, sortBy, viewMode, groupBySeries, gridColumns };
    localStorage.setItem("petrichor_library_settings", JSON.stringify(settings));
  }, [searchQuery, selectedStatuses, selectedTags, sortBy, viewMode, groupBySeries, gridColumns, isInitialized]);

  const resetSettings = useCallback(() => {
    setSearchQuery("");
    setSelectedStatuses([]);
    setSelectedTags([]);
    setGroupBySeries(false);
    setSortBy("added-desc");
    setGridColumns(DEFAULT_GRID_COLUMNS);
    localStorage.removeItem("petrichor_library_settings");
  }, []);

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
    // Only show the loading state on a cold start - if we already have a cached
    // list (e.g. returning from an author/series page), keep it visible while
    // this revalidates in the background instead of blanking the grid first.
    if (!cachedWorks) setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works`);
      if (response.ok) {
        const data = await response.json();
        cachedWorks = data;
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

  const groupedWorks = useMemo(() => {
    if (!groupBySeries) return null;
    const groups = new Map<string, Work[]>();
    const standalone: Work[] = [];
    filteredAndSortedWorks.forEach(w => {
      if (w.series) {
        if (!groups.has(w.series)) groups.set(w.series, []);
        groups.get(w.series)!.push(w);
      } else {
        standalone.push(w);
      }
    });
    const sorted = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
    if (standalone.length > 0) sorted.push(["", standalone]);
    return sorted;
  }, [filteredAndSortedWorks, groupBySeries]);

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
          onViewModeChange={setViewMode}
          onGroupBySeriesChange={setGroupBySeries}
          onReset={resetSettings}
          viewMode={viewMode}
          groupBySeries={groupBySeries}
          allTags={allTags}
          searchQuery={searchQuery}
          selectedStatuses={selectedStatuses}
          selectedTags={selectedTags}
          sortBy={sortBy}
          isInitialized={isInitialized}
          gridColumns={gridColumns}
          onGridColumnsChange={(n) => setGridColumns(clampColumns(n))}
          minGridColumns={MIN_GRID_COLUMNS}
          maxGridColumns={MAX_GRID_COLUMNS}
          effectiveGridColumns={effectiveGridColumns}
          defaultGridColumns={DEFAULT_GRID_COLUMNS}
          viewportColumnCap={viewportColumnCap}
        />

        {loading ? (
          showSpinner && (
            <p style={{ textAlign: 'center', margin: '3rem 0', color: 'var(--muted)', fontStyle: 'italic' }}>Loading library...</p>
          )
        ) : filteredAndSortedWorks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <p style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
              {works.length === 0 
                ? "No books in your library, add one using the + below!" 
                : "No books matching your filters."}
            </p>
          </div>
        ) : groupedWorks ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {groupedWorks.map(([seriesName, group]) => (
              <div key={seriesName || "__standalone__"}>
                <div style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: seriesName ? 'var(--accent)' : 'var(--muted)',
                  marginBottom: '0.75rem',
                  paddingBottom: '0.4rem',
                  borderBottom: '1px solid var(--border)'
                }}>
                  {seriesName || "Standalone"}
                </div>
                {viewMode === 'list' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {group.map((work, index) => (
                      <LibraryItem
                        key={work.id}
                        id={work.id}
                        index={index}
                        title={work.title}
                        author={work.author}
                        first_publish_year={work.first_publish_year}
                        personal_rating={work.personal_rating}
                        status={work.status}
                        page_count={work.page_count}
                        current_page={work.current_page}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="library-grid" style={{ gridTemplateColumns: `repeat(${effectiveGridColumns}, 1fr)` }}>
                    {group.map((work, index) => (
                      <BookCard
                        key={work.id}
                        id={work.id}
                        index={index}
                        title={work.title}
                        author={work.author}
                        thumbnail_url={work.thumbnail_url}
                        status={work.status}
                        page_count={work.page_count}
                        current_page={work.current_page}
                        personal_rating={work.personal_rating}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : viewMode === 'list' ? (
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
                page_count={work.page_count}
                current_page={work.current_page}
              />
            ))}
          </div>
        ) : (
          <div className="library-grid" style={{ gridTemplateColumns: `repeat(${effectiveGridColumns}, 1fr)` }}>
            {filteredAndSortedWorks.map((work, index) => (
              <BookCard
                key={work.id}
                id={work.id}
                index={index}
                title={work.title}
                author={work.author}
                thumbnail_url={work.thumbnail_url}
                status={work.status}
                page_count={work.page_count}
                current_page={work.current_page}
                personal_rating={work.personal_rating}
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
