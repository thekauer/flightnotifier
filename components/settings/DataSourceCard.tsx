'use client';

import { useDataSource, type DataSource } from '@/lib/dataSourceContext';

const OPTIONS: { value: DataSource; label: string; description: string }[] = [
  {
    value: 'backend',
    label: 'Backend API',
    description: 'Uses the Next.js backend SSE endpoint for real-time flight data with server-side enrichment.',
  },
  {
    value: 'fallback',
    label: 'Direct (Fallback)',
    description: 'Polls the OpenSky API directly from the browser, bypassing the backend. No aircraft enrichment.',
  },
];

export function DataSourceCard() {
  const { dataSource, setDataSource } = useDataSource();

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-5 py-3">
        <h2 className="text-sm font-semibold">Data Source</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Choose how flight data is fetched
        </p>
      </div>
      <div className="px-5 py-4 space-y-3">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
              dataSource === option.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/50'
            }`}
          >
            <input
              type="radio"
              name="dataSource"
              value={option.value}
              checked={dataSource === option.value}
              onChange={() => setDataSource(option.value)}
              className="mt-0.5 accent-primary"
            />
            <div>
              <div className="text-sm font-medium">{option.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {option.description}
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
