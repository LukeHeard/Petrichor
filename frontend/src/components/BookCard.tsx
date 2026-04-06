"use client";

import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface BookCardProps {
  id: number;
  title: string;
  cover_id?: string;
  cover_url?: string;
  author?: string;
}

export default function BookCard({ id, title, cover_id, cover_url, author }: BookCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.set("book_id", id.toString());
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Helper to determine the cover URL
  const getCoverUrl = (cid: string) => {
    if (!cid || cid === "null" || cid === "undefined") return null;
    if (/^\d+$/.test(cid)) {
      return `https://covers.openlibrary.org/b/id/${cid}-L.jpg`;
    }
    return `https://covers.openlibrary.org/b/olid/${cid}-L.jpg`;
  };

  // Prioritize local cover URL from backend, fallback to OpenLibrary
  const finalCoverUrl = cover_url 
    ? `${process.env.NEXT_PUBLIC_API_URL}${cover_url}` 
    : (cover_id ? getCoverUrl(cover_id) : null);

  return (
    <div className="book-card" onClick={handleClick}>
      <div className="book-card-cover">
        {finalCoverUrl ? (
          <Image
            src={finalCoverUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            style={{ objectFit: 'cover' }}
            priority={false}
          />
        ) : (
          <div className="book-card-fallback">
            <span className="font-serif">{title}</span>
          </div>
        )}
        <div className="book-card-hover">
          <div className="book-card-hover-content">
            <p className="font-serif" style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{title}</p>
            {author && <p style={{ fontSize: '0.75rem', opacity: 0.8 }}>{author}</p>}
            <p style={{ fontSize: '0.65rem', marginTop: '0.5rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>View Details</p>
          </div>
        </div>
      </div>
      <div className="book-card-info">
        <h3 className="font-serif" style={{ fontSize: '0.9rem', margin: '0.5rem 0 0.1rem 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h3>
        {author && <p style={{ fontSize: '0.75rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{author}</p>}
      </div>
    </div>
  );
}
