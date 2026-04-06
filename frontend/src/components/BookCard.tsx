"use client";

import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface BookCardProps {
  id: number;
  title: string;
  openlibrary_id?: string;
  author?: string;
}

export default function BookCard({ id, title, openlibrary_id, author }: BookCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const handleClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("book_id", id.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="book-card" onClick={handleClick}>
      <div className="book-card-cover">
        {openlibrary_id ? (
          <Image
            src={`https://covers.openlibrary.org/b/olid/${openlibrary_id}-L.jpg`}
            alt={title}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            style={{ objectFit: 'cover' }}
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
