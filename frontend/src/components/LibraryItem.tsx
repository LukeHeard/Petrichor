"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface LibraryItemProps {
  id: number;
  title: string;
  author?: string;
  first_publish_year?: number;
  personal_rating?: number;
  status?: string;
  page_count?: number;
  current_page?: number;
  index: number;
}

export default function LibraryItem({ id, title, author, first_publish_year, personal_rating, status, page_count = 0, current_page = 0, index }: LibraryItemProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const handleClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("book_id", id.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div 
      className="book-row fade-in-up" 
      onClick={handleClick}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', flex: 1, minWidth: 0 }}>
        <h3 className="font-serif" style={{ fontSize: '1.05rem', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{title}</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0, fontWeight: 500 }}>
          {author || "Unknown Author"}
          {first_publish_year ? ` (${first_publish_year})` : ""}
        </p>
      </div>
      
      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem', minWidth: '80px' }}>
        {status && (
          <span style={{ 
            fontSize: '0.6rem', 
            fontWeight: 700, 
            letterSpacing: '0.1em', 
            textTransform: 'uppercase', 
            color: 'var(--muted)',
            opacity: 0.8
          }}>
            {status}
          </span>
        )}
        
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.15rem' }}>
          <span className="font-serif" style={{ 
            fontSize: '1.1rem', 
            fontWeight: 600, 
            color: personal_rating && personal_rating > 0 ? 'var(--accent)' : 'var(--muted)',
            opacity: personal_rating && personal_rating > 0 ? 1 : 0.4
          }}>
            {personal_rating && personal_rating > 0 ? personal_rating.toFixed(1) : "—"}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', opacity: 0.3, fontWeight: 500 }}>/10</span>
        </div>
      </div>

      {status === "Reading" && page_count > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: '1.25rem',
          right: '1.25rem',
          height: '2px',
          background: 'color-mix(in srgb, var(--border) 30%, transparent)',
          borderRadius: '1px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${Math.min(100, (current_page / page_count) * 100)}%`,
            height: '100%',
            background: 'var(--accent)',
            opacity: 0.8,
            transition: 'width 0.4s ease'
          }} />
          <span style={{
            position: 'absolute',
            right: 0,
            bottom: '4px',
            fontSize: '0.6rem',
            fontWeight: 700,
            color: 'var(--accent)',
            opacity: 0.6
          }}>
            {Math.round((current_page / page_count) * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
