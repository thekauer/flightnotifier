import { notFound } from 'next/navigation';
import { RunwayLabMap } from '@/components/runway-lab/RunwayLabMap';

export default function ComponentPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return (
    <main className="h-screen w-screen">
      <RunwayLabMap />
    </main>
  );
}
