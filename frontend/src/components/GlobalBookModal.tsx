"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import BookDetailsContent from "./BookDetailsContent";
import PersonalLibraryControls from "./PersonalLibraryControls";
import TagManager from "./TagManager";

interface FullWork {
  id: number;
  title: string;
  author?: string;
  author_id?: number;
  series?: string;
  series_id?: number;
  goodreads_id?: string;
  thumbnail_url?: string;
  first_publish_year?: number;
  description?: string;
  page_count?: number;
  rating_average?: number;
  rating_count?: number;
  tags?: string[];
  personal_rating?: number;
  status?: string;
  current_page?: number;
  review?: string;
  personal_notes?: string;
}

interface Author {
  id: number;
  name: string;
}

interface Series {
  id: number;
  name: string;
}

export default function GlobalBookModal() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const bookId = searchParams.get("book_id");

  const [book, setBook] = useState<FullWork | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "notes">("details");

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editYear, setEditYear] = useState<number | undefined>(0);
  const [editDescription, setEditDescription] = useState("");
  const [editPages, setEditPages] = useState<number | undefined>(0);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editAuthorId, setEditAuthorId] = useState<number | undefined>(undefined);
  const [editAuthorInput, setEditAuthorInput] = useState("");
  const [authorDropdownOpen, setAuthorDropdownOpen] = useState(false);
  const [authorHighlightedIndex, setAuthorHighlightedIndex] = useState(0);
  const [authors, setAuthors] = useState<Author[]>([]);
  const authorInputRef = useRef<HTMLInputElement>(null);
  const [editSeriesId, setEditSeriesId] = useState<number | undefined>(undefined);
  const [editSeriesInput, setEditSeriesInput] = useState("");
  const [seriesDropdownOpen, setSeriesDropdownOpen] = useState(false);
  const [seriesHighlightedIndex, setSeriesHighlightedIndex] = useState(0);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const seriesInputRef = useRef<HTMLInputElement>(null);
  const [editThumbnailUrl, setEditThumbnailUrl] = useState<string | undefined>(undefined);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [pendingCoverPreview, setPendingCoverPreview] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (bookId) {
      setLoading(true);
      setBook(null);
      setTimedOut(false);
      setIsDeleting(false);

      // 5 second timeout for showing error
      timer = setTimeout(() => {
        if (!book) setTimedOut(true);
      }, 5000);

      Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${bookId}`).then(res => res.json()),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/authors`).then(res => res.json()),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/series`).then(res => res.json()),
      ])
        .then(([data, authorList, seriesData]) => {
          setBook(data);
          setEditTitle(data.title);
          setEditYear(data.first_publish_year);
          setEditDescription(data.description || "");
          setEditPages(data.page_count || 0);
          setEditTags(data.tags || []);
          setEditAuthorId(data.author_id);
          setEditAuthorInput(data.author || "");
          setAuthors(authorList);
          setEditSeriesId(data.series_id);
          setEditSeriesInput(data.series || "");
          setSeriesList(seriesData);
          setEditThumbnailUrl(data.thumbnail_url);
          clearTimeout(timer);
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    } else {
      setBook(null);
      setTimedOut(false);
      setActiveTab("details");
    }
    return () => clearTimeout(timer);
  }, [bookId]);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (book && e.detail.id === book.id) {
        setBook({ ...book, ...e.detail });
      }
    };
    window.addEventListener("petrichor:workUpdated", handleUpdate);
    return () => window.removeEventListener("petrichor:workUpdated", handleUpdate);
  }, [book]);

  if (!bookId) return null;

  const closeModal = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete("book_id");
    const query = newParams.toString();
    router.push(`${pathname}${query ? `?${query}` : ''}`);
    setIsEditing(false);
  };

  const handleCoverSelect = (file: File) => {
    if (pendingCoverPreview) URL.revokeObjectURL(pendingCoverPreview);
    const preview = URL.createObjectURL(file);
    setPendingCoverFile(file);
    setPendingCoverPreview(preview);
  };

  const handleSave = async () => {
    if (!book) return;
    setLoading(true);
    try {
      // Upload pending cover if one was selected
      if (pendingCoverFile) {
        setCoverUploading(true);
        const formData = new FormData();
        formData.append("file", pendingCoverFile);
        const coverRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${book.id}/cover`, {
          method: "POST",
          body: formData,
        });
        setCoverUploading(false);
        if (coverRes.ok) {
          const coverData = await coverRes.json();
          setEditThumbnailUrl(coverData.thumbnail_url);
        }
        if (pendingCoverPreview) URL.revokeObjectURL(pendingCoverPreview);
        setPendingCoverFile(null);
        setPendingCoverPreview(null);
      }

      // If a new author name was typed (no ID), create the author first
      let resolvedAuthorId = editAuthorId;
      const trimmedAuthorInput = editAuthorInput.trim();
      if (trimmedAuthorInput && !editAuthorId) {
        const authorRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/authors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmedAuthorInput })
        });
        if (authorRes.ok) {
          const authorData = await authorRes.json();
          resolvedAuthorId = authorData.id;
          setAuthors(prev => prev.some(a => a.id === authorData.id) ? prev : [...prev, authorData]);
        }
      }

      // If a new series name was typed (no ID), create the series first
      let resolvedSeriesId = editSeriesId;
      const trimmedSeriesInput = editSeriesInput.trim();
      if (trimmedSeriesInput && !editSeriesId) {
        const seriesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/series`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmedSeriesInput })
        });
        if (seriesRes.ok) {
          const seriesData = await seriesRes.json();
          resolvedSeriesId = seriesData.id;
          setSeriesList(prev => prev.some(s => s.id === seriesData.id) ? prev : [...prev, seriesData]);
        }
      }
      // If the series field was cleared, send -1 to remove the series
      if (!trimmedSeriesInput && book.series_id) {
        resolvedSeriesId = -1;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          first_publish_year: editYear,
          page_count: editPages,
          description: editDescription,
          tags: editTags,
          ...(resolvedAuthorId !== undefined ? { author_id: resolvedAuthorId } : {}),
          ...(resolvedSeriesId !== undefined ? { series_id: resolvedSeriesId } : {})
        })
      });
      if (res.ok) {
        const updatedWork = await res.json();
        setBook(updatedWork);
        setIsEditing(false);
        // Refresh library list
        window.dispatchEvent(new Event("petrichor:workAdded"));
      }
    } catch (err) {
      console.error("Failed to save work", err);
    } finally {
      setLoading(false);
    }
  };

  // If we don't have a book and we haven't timed out, don't show the modal at all
  if (!book && !timedOut) return null;

  return (
    <div 
      onClick={closeModal}
      style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'color-mix(in srgb, var(--background) 90%, transparent)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 3000, padding: '1rem'
    }}>
      <div 
        onClick={e => e.stopPropagation()}
        style={{
        width: '100%', maxWidth: '460px', height: '700px', maxHeight: '90vh',
        background: 'var(--background)',
        border: '1px solid var(--border)',
        padding: 0,
        borderRadius: '8px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeInUp 0.3s ease'
      }}>
        <button onClick={closeModal} style={{ position: 'absolute', top: '1rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.5rem', lineHeight: 1, zIndex: 10 }}>&times;</button>

        {book ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '2rem 2rem 0' }}>
            {/* Tabs */}
            <div style={{
              display: 'flex',
              gap: '1.5rem',
              marginBottom: '2rem',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '0.5rem'
            }}>
              <button
                onClick={() => setActiveTab("details")}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0.5rem 0',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: activeTab === "details" ? 'var(--foreground)' : 'var(--muted)',
                  borderBottom: activeTab === "details" ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: '-0.6rem',
                  transition: 'all 0.2s ease',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em'
                }}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab("notes")}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0.5rem 0',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: activeTab === "notes" ? 'var(--foreground)' : 'var(--muted)',
                  borderBottom: activeTab === "notes" ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: '-0.6rem',
                  transition: 'all 0.2s ease',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em'
                }}
              >
                Notes
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '0 2rem 2rem 2rem' }}>
              {activeTab === "details" ? (
                isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeInUp 0.3s ease' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleCoverSelect(file);
                          e.target.value = "";
                        }}
                      />
                      <div
                        onClick={() => coverInputRef.current?.click()}
                        style={{
                          width: '90px',
                          height: '135px',
                          position: 'relative',
                          borderRadius: '4px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                          border: '1px solid var(--border)',
                          flexShrink: 0,
                        }}
                      >
                        {(pendingCoverPreview || editThumbnailUrl) ? (
                          <img
                            src={pendingCoverPreview ?? (editThumbnailUrl!.startsWith('/uploads') ? `${process.env.NEXT_PUBLIC_API_URL}${editThumbnailUrl}` : editThumbnailUrl!)}
                            alt="Cover"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: 'color-mix(in srgb, var(--muted) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', opacity: 0.5 }}><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                          </div>
                        )}
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: coverUploading ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'background 0.2s ease',
                          color: 'white',
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          opacity: coverUploading ? 1 : 0,
                        }}
                          onMouseEnter={e => { if (!coverUploading) (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.45)'; (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                          onMouseLeave={e => { if (!coverUploading) { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0)'; (e.currentTarget as HTMLDivElement).style.opacity = '0'; } }}
                        >
                          Change
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Title</label>
                      <input 
                        type="text" 
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.6rem', color: 'var(--foreground)', fontSize: '0.95rem', outline: 'none' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Author</label>
                      {(() => {
                        const filteredAuthors = editAuthorInput.trim()
                          ? authors.filter(a => a.name.toLowerCase().includes(editAuthorInput.toLowerCase()))
                          : authors.slice().sort((a, b) => a.name.localeCompare(b.name));
                        const exactMatch = authors.some(a => a.name.toLowerCase() === editAuthorInput.trim().toLowerCase());
                        const showCreate = editAuthorInput.trim() && !exactMatch;
                        const dropdownItems = filteredAuthors.slice(0, 6);
                        const totalItems = dropdownItems.length + (showCreate ? 1 : 0);
                        return (
                          <div style={{ position: 'relative' }}>
                            <input
                              ref={authorInputRef}
                              type="text"
                              value={editAuthorInput}
                              placeholder="Search or add author..."
                              onChange={e => {
                                setEditAuthorInput(e.target.value);
                                setEditAuthorId(undefined);
                                setAuthorHighlightedIndex(0);
                                setAuthorDropdownOpen(true);
                              }}
                              onFocus={() => setAuthorDropdownOpen(true)}
                              onBlur={() => setTimeout(() => setAuthorDropdownOpen(false), 150)}
                              onKeyDown={e => {
                                if (!authorDropdownOpen) return;
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  setAuthorHighlightedIndex(prev => Math.min(prev + 1, totalItems - 1));
                                } else if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  setAuthorHighlightedIndex(prev => Math.max(prev - 1, 0));
                                } else if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (authorHighlightedIndex < dropdownItems.length) {
                                    const a = dropdownItems[authorHighlightedIndex];
                                    setEditAuthorInput(a.name);
                                    setEditAuthorId(a.id);
                                  }
                                  // if showCreate and highlighted on create row, just keep the typed name (saved on submit)
                                  setAuthorDropdownOpen(false);
                                } else if (e.key === "Escape") {
                                  setAuthorDropdownOpen(false);
                                }
                              }}
                              style={{ width: '100%', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.6rem', color: 'var(--foreground)', fontSize: '0.95rem', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }}
                            />
                            {authorDropdownOpen && totalItems > 0 && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '4px', marginTop: '0.25rem', overflow: 'hidden', zIndex: 10, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                {dropdownItems.map((a, i) => (
                                  <div
                                    key={a.id}
                                    onMouseDown={() => {
                                      setEditAuthorInput(a.name);
                                      setEditAuthorId(a.id);
                                      setAuthorDropdownOpen(false);
                                    }}
                                    onMouseEnter={() => setAuthorHighlightedIndex(i)}
                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', cursor: 'pointer', backgroundColor: i === authorHighlightedIndex ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent', color: i === authorHighlightedIndex ? 'var(--accent)' : 'var(--foreground)' }}
                                  >
                                    {a.name}
                                  </div>
                                ))}
                                {showCreate && (
                                  <div
                                    onMouseDown={() => setAuthorDropdownOpen(false)}
                                    onMouseEnter={() => setAuthorHighlightedIndex(dropdownItems.length)}
                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', cursor: 'pointer', backgroundColor: authorHighlightedIndex === dropdownItems.length ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent', color: authorHighlightedIndex === dropdownItems.length ? 'var(--accent)' : 'var(--muted)', borderTop: dropdownItems.length > 0 ? '1px solid var(--border)' : 'none' }}
                                  >
                                    + Create &ldquo;{editAuthorInput.trim()}&rdquo;
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Series</label>
                      {(() => {
                        const filteredSeries = editSeriesInput.trim()
                          ? seriesList.filter(s => s.name.toLowerCase().includes(editSeriesInput.toLowerCase()))
                          : seriesList.slice().sort((a, b) => a.name.localeCompare(b.name));
                        const exactMatch = seriesList.some(s => s.name.toLowerCase() === editSeriesInput.trim().toLowerCase());
                        const showCreate = editSeriesInput.trim() && !exactMatch;
                        const dropdownItems = filteredSeries.slice(0, 6);
                        const totalItems = dropdownItems.length + (showCreate ? 1 : 0);
                        return (
                          <div style={{ position: 'relative' }}>
                            <input
                              ref={seriesInputRef}
                              type="text"
                              value={editSeriesInput}
                              placeholder="Search or add series..."
                              onChange={e => {
                                setEditSeriesInput(e.target.value);
                                setEditSeriesId(undefined);
                                setSeriesHighlightedIndex(0);
                                setSeriesDropdownOpen(true);
                              }}
                              onFocus={() => setSeriesDropdownOpen(true)}
                              onBlur={() => setTimeout(() => setSeriesDropdownOpen(false), 150)}
                              onKeyDown={e => {
                                if (!seriesDropdownOpen) return;
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  setSeriesHighlightedIndex(prev => Math.min(prev + 1, totalItems - 1));
                                } else if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  setSeriesHighlightedIndex(prev => Math.max(prev - 1, 0));
                                } else if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (seriesHighlightedIndex < dropdownItems.length) {
                                    const s = dropdownItems[seriesHighlightedIndex];
                                    setEditSeriesInput(s.name);
                                    setEditSeriesId(s.id);
                                  }
                                  setSeriesDropdownOpen(false);
                                } else if (e.key === "Escape") {
                                  setSeriesDropdownOpen(false);
                                }
                              }}
                              style={{ width: '100%', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.6rem', color: 'var(--foreground)', fontSize: '0.95rem', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }}
                            />
                            {seriesDropdownOpen && (totalItems > 0 || editSeriesInput.trim()) && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '4px', marginTop: '0.25rem', overflow: 'hidden', zIndex: 10, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                {dropdownItems.map((s, i) => (
                                  <div
                                    key={s.id}
                                    onMouseDown={() => {
                                      setEditSeriesInput(s.name);
                                      setEditSeriesId(s.id);
                                      setSeriesDropdownOpen(false);
                                    }}
                                    onMouseEnter={() => setSeriesHighlightedIndex(i)}
                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', cursor: 'pointer', backgroundColor: i === seriesHighlightedIndex ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent', color: i === seriesHighlightedIndex ? 'var(--accent)' : 'var(--foreground)' }}
                                  >
                                    {s.name}
                                  </div>
                                ))}
                                {showCreate && (
                                  <div
                                    onMouseDown={() => setSeriesDropdownOpen(false)}
                                    onMouseEnter={() => setSeriesHighlightedIndex(dropdownItems.length)}
                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', cursor: 'pointer', backgroundColor: seriesHighlightedIndex === dropdownItems.length ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent', color: seriesHighlightedIndex === dropdownItems.length ? 'var(--accent)' : 'var(--muted)', borderTop: dropdownItems.length > 0 ? '1px solid var(--border)' : 'none' }}
                                  >
                                    + Create &ldquo;{editSeriesInput.trim()}&rdquo;
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>First Published Year</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <button 
                          onClick={() => setEditYear(prev => Math.max(0, (prev || 0) - 1))}
                          className="btn-ghost"
                          style={{ padding: '0.6rem 0.8rem', borderRadius: '4px', minWidth: '40px' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
                        </button>
                        <input 
                          type="number" 
                          value={editYear || ""}
                          onChange={e => setEditYear(parseInt(e.target.value) || 0)}
                          style={{ 
                            flex: 1, 
                            background: 'transparent', 
                            border: '1px solid var(--border)', 
                            borderRadius: '4px', 
                            padding: '0.6rem', 
                            color: 'var(--foreground)', 
                            fontSize: '0.95rem', 
                            outline: 'none',
                            textAlign: 'center',
                            fontFamily: 'var(--font-sans)'
                          }}
                        />
                        <button 
                          onClick={() => setEditYear(prev => (prev || 0) + 1)}
                          className="btn-ghost"
                          style={{ padding: '0.6rem 0.8rem', borderRadius: '4px', minWidth: '40px' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Total Pages</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <button 
                          onClick={() => setEditPages(prev => Math.max(0, (prev || 0) - 10))}
                          className="btn-ghost"
                          style={{ padding: '0.6rem 0.8rem', borderRadius: '4px', minWidth: '40px' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
                        </button>
                        <input 
                          type="number" 
                          value={editPages || ""}
                          onChange={e => setEditPages(parseInt(e.target.value) || 0)}
                          style={{ 
                            flex: 1, 
                            background: 'transparent', 
                            border: '1px solid var(--border)', 
                            borderRadius: '4px', 
                            padding: '0.6rem', 
                            color: 'var(--foreground)', 
                            fontSize: '0.95rem', 
                            outline: 'none',
                            textAlign: 'center',
                            fontFamily: 'var(--font-sans)'
                          }}
                        />
                        <button 
                          onClick={() => setEditPages(prev => (prev || 0) + 10)}
                          className="btn-ghost"
                          style={{ padding: '0.6rem 0.8rem', borderRadius: '4px', minWidth: '40px' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Tags</label>
                      <TagManager tags={editTags} onTagsChange={setEditTags} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Description</label>
                      <textarea 
                        value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                        rows={8}
                        style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.6rem', color: 'var(--foreground)', fontSize: '0.9rem', outline: 'none', resize: 'vertical', fontFamily: 'var(--font-serif)', lineHeight: '1.5' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                      <button 
                        onClick={() => {
                          setIsEditing(false);
                          setEditTitle(book.title);
                          setEditYear(book.first_publish_year);
                          setEditDescription(book.description || "");
                          setEditPages(book.page_count || 0);
                          setEditTags(book.tags || []);
                          setEditAuthorId(book.author_id);
                          setEditAuthorInput(book.author || "");
                          setEditSeriesId(book.series_id);
                          setEditSeriesInput(book.series || "");
                          setEditThumbnailUrl(book.thumbnail_url);
                          if (pendingCoverPreview) URL.revokeObjectURL(pendingCoverPreview);
                          setPendingCoverFile(null);
                          setPendingCoverPreview(null);
                        }}
                        className="btn-ghost"
                        style={{ flex: 1, padding: '0.75rem' }}
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSave}
                        className="btn-primary"
                        style={{ flex: 1, padding: '0.75rem' }}
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <BookDetailsContent
                    book={book}
                    actions={
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: 'auto', paddingTop: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                          <button 
                            onClick={() => setIsEditing(true)}
                            className="btn-ghost"
                            style={{ 
                              padding: '0.5rem 1.25rem', 
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              border: '1px solid var(--border)',
                              opacity: 0.8
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                            Edit Details
                          </button>

                          <button
                            onClick={async () => {
                              if (!isDeleting) {
                                setIsDeleting(true);
                                return;
                              }
                              try {
                                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${book.id}`, { method: 'DELETE' });
                                if (res.ok) {
                                  window.dispatchEvent(new Event("petrichor:workAdded"));
                                  closeModal();
                                }
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isDeleting) {
                                e.currentTarget.style.color = 'var(--muted)';
                                e.currentTarget.style.borderColor = 'var(--border)';
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.opacity = '0.6';
                              } else {
                                setIsDeleting(false);
                              }
                            }}
                            style={{
                              background: isDeleting ? 'color-mix(in srgb, #ff4444 10%, transparent)' : 'none',
                              border: '1px solid var(--border)',
                              borderColor: isDeleting ? 'color-mix(in srgb, #ff4444 40%, transparent)' : 'var(--border)',
                              color: isDeleting ? '#ff4444' : 'var(--muted)',
                              padding: '0.5rem 1.25rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              transition: 'all 0.2s ease',
                              fontFamily: 'var(--font-sans)',
                              letterSpacing: '0.02em',
                              opacity: isDeleting ? 1 : 0.6,
                              minWidth: '160px', // Slightly wider to ensure "Remove from Library" fits
                              justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => {
                              if (!isDeleting) {
                                e.currentTarget.style.color = '#ff4444';
                                e.currentTarget.style.borderColor = 'color-mix(in srgb, #ff4444 30%, transparent)';
                                e.currentTarget.style.backgroundColor = 'color-mix(in srgb, #ff4444 5%, transparent)';
                                e.currentTarget.style.opacity = '1';
                              }
                            }}
                          >
                            {isDeleting ? "Confirm?" : "Remove from Library"}
                          </button>
                        </div>
                      </div>
                    }
                  />
                )
              ) : (
                <PersonalLibraryControls
                  workId={book.id}
                  initialStatus={book.status || "Owned"}
                  initialRating={book.personal_rating || 0}
                  initialCurrentPage={book.current_page || 0}
                  pageCount={book.page_count || 0}
                  initialReview={book.review || ""}
                  initialNotes={book.personal_notes || ""}
                />
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem', fontStyle: 'italic' }}>Taking longer than usual...</p>
            <button onClick={closeModal} className="btn-ghost" style={{ marginTop: '1rem', padding: '0.4rem 1rem', fontSize: '0.8rem' }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
