"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import BookDetailsContent from "./BookDetailsContent";
import PersonalLibraryControls from "./PersonalLibraryControls";
import TagManager from "./TagManager";

interface FullWork {
  id: number;
  title: string;
  author?: string;
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
  const [editTags, setEditTags] = useState<string[]>([]);

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

      fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${bookId}`)
        .then(res => res.json())
        .then(data => {
          setBook(data);
          setEditTitle(data.title);
          setEditYear(data.first_publish_year);
          setEditDescription(data.description || "");
          setEditTags(data.tags || []);
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

  const handleSave = async () => {
    if (!book) return;
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          first_publish_year: editYear,
          description: editDescription,
          tags: editTags
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
      zIndex: 3000, padding: '1rem',
      cursor: 'pointer'
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
        animation: 'fadeInUp 0.3s ease',
        cursor: 'default'
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
                          setEditTags(book.tags || []);
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
