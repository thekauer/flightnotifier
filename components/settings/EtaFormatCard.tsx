'use client';

import { useEtaFormat, type EtaFormat } from '@/lib/etaFormatContext';

function FormatOption({
  value,
  label,
  description,
  selected,
  onSelect,
}: {
  value: EtaFormat;
  label: string;
  description: string;
  selected: boolean;
  onSelect: (value: EtaFormat) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex-1 rounded-lg border-2 px-4 py-3 text-left transition-colors cursor-pointer ${
        selected
          ? 'border-blue-600 bg-blue-600/5'
          : 'border-border hover:border-muted-foreground/40'
      }`}
    >
      <div className="text-sm font-semibold tabular-nums">{label}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
    </button>
  );
}

export function EtaFormatCard() {
  const { etaFormat, setEtaFormat } = useEtaFormat();

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-5 py-3">
        <h2 className="text-sm font-semibold">ETA Format</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Choose how countdown times are displayed
        </p>
      </div>
      <div className="px-5 py-4">
        <div className="flex gap-3">
          <FormatOption
            value="colon"
            label="3:42"
            description="Colon format (3:42)"
            selected={etaFormat === 'colon'}
            onSelect={setEtaFormat}
          />
          <FormatOption
            value="quotes"
            label={'3\'42"'}
            description={'Quote format (3\'42")'}
            selected={etaFormat === 'quotes'}
            onSelect={setEtaFormat}
          />
        </div>
      </div>
    </div>
  );
}
