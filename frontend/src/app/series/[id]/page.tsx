"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import BookCard from "@/components/BookCard";
import DiscoverSection from "@/components/DiscoverSection";

interface Work {
  id: number;
  title: string;
  thumbnail_url?: string;
  author?: string;
  status?: string;
  page_count?: number;
  current_page?: number;
  personal_rating?: number;
  first_publish_year?: number;
}

interface SeriesDetail {
  id: number;
  name: string;
  works: Work[];
}

export default function SeriesPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<SeriesDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchSeries = useCallback(() => {
    setLoading(true);
    setNotFound(false);
    return fetch(`${process.env.NEXT_PUBLIC_API_URL}/series/${id}`)
      .then(res => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  return (
    <div className="fade-in-up">
      <button
        className="btn-ghost"
        onClick={() => router.back()}
        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '2rem', padding: '0.4rem 0.8rem' }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      {loading ? (
        <p style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>Loading series...</p>
      ) : notFound || !data ? (
        <p style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>Series not found.</p>
      ) : (
        <>
          <header style={{ marginBottom: '2.5rem' }}>
            <h1 style={{ marginBottom: '0.25rem' }}>{data.name}</h1>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', letterSpacing: '0.02em' }}>
              {data.works.length} {data.works.length === 1 ? "book" : "books"} in your library, ordered by publish year
            </p>
          </header>

          <div className="library-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {data.works.map((work, index) => (
              <BookCard
                key={work.id}
                id={work.id}
                title={work.title}
                thumbnail_url={work.thumbnail_url}
                author={work.author}
                status={work.status}
                page_count={work.page_count}
                current_page={work.current_page}
                personal_rating={work.personal_rating}
                index={index}
              />
            ))}
          </div>

          <DiscoverSection
            title={`More in ${data.name}`}
            emptyText={`No other ${data.name} books found that aren't already in your library.`}
            fetchUrl={`${process.env.NEXT_PUBLIC_API_URL}/series/${data.id}/discover`}
            linkSeriesId={data.id}
            onAdded={fetchSeries}
          />
        </>
      )}
    </div>
  );
}
