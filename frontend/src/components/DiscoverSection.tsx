"use client";

import { useEffect, useState } from "react";
import BookDetailsContent from "./BookDetailsContent";

interface DiscoverResult {
  title: string;
  author: string;
  series?: string;
  first_publish_year?: number;
  goodreads_id?: string;
  thumbnail_url?: string;
  description?: string;
  page_count?: number;
  rating_average?: number;
  rating_count?: number;
  tags?: string[];
}

interface DiscoverSectionProps {
  title: string;
  emptyText: string;
  fetchUrl: string;
  // Pass whichever side of the relationship this page already knows (author page
  // knows the author id, series page knows the series id) - the other side gets
  // resolved/created by name, same as the main Add Work flow does.
  linkAuthorId?: number;
  linkSeriesId?: number;
  onAdded?: () => void;
}

export default function DiscoverSection({ title, emptyText, fetchUrl, linkAuthorId, linkSeriesId, onAdded }: DiscoverSectionProps) {
  const [results, setResults] = useState<DiscoverResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [previewResult, setPreviewResult] = useState<DiscoverResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(fetchUrl)
      .then(res => res.ok ? res.json() : [])
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [fetchUrl]);

  // The discover/search stub is missing page_count/description/tags - enrich it so
  // both the preview and the added book have real details, same as the main Add
  // Work flow's search results do.
  const enrichResult = async (result: DiscoverResult): Promise<DiscoverResult> => {
    if (!result.goodreads_id) return result;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/enrich/${encodeURIComponent(result.goodreads_id)}`);
    if (!res.ok) return result;
    const data = await res.json();
    return {
      ...result,
      description: data.description,
      tags: data.tags && data.tags.length > 0 ? data.tags : result.tags,
      page_count: data.page_count || result.page_count,
      first_publish_year: data.first_publish_year || result.first_publish_year,
      rating_average: data.rating_average || result.rating_average,
      rating_count: data.rating_count || result.rating_count,
      series: data.series || result.series || ""
    };
  };

  const handlePreview = async (result: DiscoverResult) => {
    setPreviewLoading(true);
    try {
      setPreviewResult(await enrichResult(result));
    } catch (err) {
      console.error("Failed to enrich discovered book", err);
      setPreviewResult({ ...result, description: "Failed to load details." });
    } finally {
      setPreviewLoading(false);
    }
  };

  const resolveByName = async (endpoint: "authors" | "series", name: string): Promise<number | null> => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id;
  };

  const handleAdd = async (result: DiscoverResult) => {
    const key = result.goodreads_id || result.title;
    setAddingId(key);
    setError("");
    try {
      // If this came straight from the "+ Add" button (not the preview), it hasn't
      // been enriched yet - do that now so the saved book isn't sparse.
      const enriched = result.description !== undefined ? result : await enrichResult(result);

      const workRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: enriched.title,
          goodreads_id: enriched.goodreads_id || null,
          thumbnail_url: enriched.thumbnail_url || null,
          first_publish_year: enriched.first_publish_year || 0,
          description: enriched.description || "",
          page_count: enriched.page_count || 0,
          rating_average: enriched.rating_average || 0,
          rating_count: enriched.rating_count || 0,
          tags: enriched.tags || []
        })
      });
      if (!workRes.ok) throw new Error("Failed to add book");
      const work = await workRes.json();

      const authorId = linkAuthorId ?? await resolveByName("authors", enriched.author);
      if (authorId != null) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${work.id}/authors/${authorId}`, { method: 'POST' });
      }

      const seriesName = enriched.series?.trim();
      const seriesId = linkSeriesId ?? (seriesName ? await resolveByName("series", seriesName) : null);
      if (seriesId != null) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${work.id}/series/${seriesId}`, { method: 'POST' });
      }

      setResults(prev => prev.filter(r => (r.goodreads_id || r.title) !== key));
      setPreviewResult(prev => (prev && (prev.goodreads_id || prev.title) === key ? null : prev));
      onAdded?.();
    } catch (err) {
      console.error("Failed to add discovered book", err);
      setError("Failed to add that book. Please try again.");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <section style={{ marginTop: '3.5rem' }}>
      <h2 className="section-label">{title}</h2>
      <div className="thin-divider" style={{ marginTop: 0 }} />

      {error && <p style={{ color: '#b91c1c', fontSize: '0.85rem', fontStyle: 'italic', margin: '0.5rem 0' }}>{error}</p>}

      {loading ? (
        <p style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.9rem', padding: '1rem 0' }}>Searching Goodreads...</p>
      ) : results.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.9rem', padding: '1rem 0' }}>{emptyText}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {results.map((r) => {
            const key = r.goodreads_id || r.title;
            return (
              <div
                key={key}
                className="book-row"
                style={{ padding: '0.75rem', cursor: 'pointer' }}
                onClick={() => handlePreview(r)}
              >
                <div style={{ flex: 1, minWidth: 0, pointerEvents: 'none' }}>
                  <h3 className="font-serif" style={{ fontSize: '1.05rem', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{r.title}</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0, fontWeight: 500 }}>
                    {r.author}{r.first_publish_year ? ` (${r.first_publish_year})` : ""}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleAdd(r); }}
                  className="btn-ghost"
                  style={{ padding: '0.3rem 0.9rem', fontSize: '0.8rem', flexShrink: 0 }}
                  disabled={addingId === key}
                >
                  {addingId === key ? "Adding..." : "+ Add"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {previewResult && (
        <div className="modal-overlay" onClick={() => setPreviewResult(null)}>
          <div className="modal-content" style={{ maxWidth: '460px', maxHeight: '85vh', overflowY: 'auto', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewResult(null)}
              style={{ position: 'absolute', top: '1rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.5rem', lineHeight: 1 }}
            >
              &times;
            </button>
            {previewLoading ? (
              <p style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--muted)', fontStyle: 'italic' }}>Loading details...</p>
            ) : (
              <BookDetailsContent
                book={previewResult}
                actions={
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                    <button
                      onClick={() => handleAdd(previewResult)}
                      className="btn-primary"
                      style={{ padding: '0.6rem 1.5rem' }}
                      disabled={addingId === (previewResult.goodreads_id || previewResult.title)}
                    >
                      {addingId === (previewResult.goodreads_id || previewResult.title) ? "Adding..." : "+ Add to Library"}
                    </button>
                  </div>
                }
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
