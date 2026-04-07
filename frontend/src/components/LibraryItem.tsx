"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface LibraryItemProps {
  id: number;
  title: string;
  author?: string;
  first_publish_year?: number;
  index: number;
}

export default function LibraryItem({ id, title, author, first_publish_year, index }: LibraryItemProps) {
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <h3 className="font-serif" style={{ fontSize: '1.1rem', margin: 0 }}>{title}</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>
          {author || "Unknown Author"}
        </p>
      </div>
      
      <div style={{ textAlign: 'right' }}>
        {first_publish_year ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', fontStyle: 'italic', margin: 0 }}>
            {first_publish_year}
          </p>
        ) : (
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', opacity: 0.3, margin: 0 }}>—</p>
        )}
      </div>
    </div>
  );
}
