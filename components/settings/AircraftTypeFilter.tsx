'use client';

import { useState, useCallback } from 'react';
import { useAircraftFilter } from '@/lib/aircraftFilterContext';
import {
  AIRCRAFT_TYPE_HIERARCHY,
  getCodesForCategory,
  getCodesForFamily,
} from '@/lib/aircraftTypes';

type CheckState = 'checked' | 'unchecked' | 'indeterminate';

function CheckboxIcon({ state }: { state: CheckState }) {
  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
        state === 'checked'
          ? 'border-primary bg-primary text-primary-foreground'
          : state === 'indeterminate'
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-input bg-background'
      }`}
    >
      {state === 'checked' && (
        <svg
          className="h-3 w-3"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 6l2.5 2.5 4.5-4.5" />
        </svg>
      )}
      {state === 'indeterminate' && (
        <svg
          className="h-3 w-3"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M3 6h6" />
        </svg>
      )}
    </span>
  );
}

function ExpandChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 2.5l4 3.5-4 3.5" />
    </svg>
  );
}

function VariantRow({
  code,
  name,
  enabled,
  onToggle,
}: {
  code: string;
  name: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-muted/50"
    >
      <CheckboxIcon state={enabled ? 'checked' : 'unchecked'} />
      <span className="font-mono text-muted-foreground">{code}</span>
      <span className="text-foreground">{name}</span>
    </button>
  );
}

function FamilyRow({
  family,
  enabledTypes,
  onToggleFamily,
  onToggleType,
}: {
  family: (typeof AIRCRAFT_TYPE_HIERARCHY)[number]['families'][number];
  enabledTypes: Set<string>;
  onToggleFamily: (family: string) => void;
  onToggleType: (code: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const codes = family.variants.map((v) => v.code);
  const enabledCount = codes.filter((c) => enabledTypes.has(c)).length;
  const familyState: CheckState =
    enabledCount === 0
      ? 'unchecked'
      : enabledCount === codes.length
        ? 'checked'
        : 'indeterminate';

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleFamily(family.family);
    },
    [onToggleFamily, family.family],
  );

  return (
    <div>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 rounded p-1 transition-colors hover:bg-muted/50"
        >
          <ExpandChevron expanded={expanded} />
        </button>
        <button
          type="button"
          onClick={handleCheckboxClick}
          className="flex flex-1 items-center gap-2 rounded px-1 py-1 text-left text-sm transition-colors hover:bg-muted/50"
        >
          <CheckboxIcon state={familyState} />
          <span className="font-medium">{family.name}</span>
          <span className="text-xs text-muted-foreground">
            {enabledCount}/{codes.length}
          </span>
        </button>
      </div>
      {expanded && (
        <div className="ml-7 border-l border-border/50 pl-2">
          {family.variants.map((v) => (
            <VariantRow
              key={v.code}
              code={v.code}
              name={v.name}
              enabled={enabledTypes.has(v.code)}
              onToggle={() => onToggleType(v.code)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  cat,
  enabledTypes,
  onToggleCategory,
  onToggleFamily,
  onToggleType,
}: {
  cat: (typeof AIRCRAFT_TYPE_HIERARCHY)[number];
  enabledTypes: Set<string>;
  onToggleCategory: (category: string) => void;
  onToggleFamily: (family: string) => void;
  onToggleType: (code: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const codes = getCodesForCategory(cat.category);
  const enabledCount = codes.filter((c) => enabledTypes.has(c)).length;
  const categoryState: CheckState =
    enabledCount === 0
      ? 'unchecked'
      : enabledCount === codes.length
        ? 'checked'
        : 'indeterminate';

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleCategory(cat.category);
    },
    [onToggleCategory, cat.category],
  );

  return (
    <div>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 rounded p-1 transition-colors hover:bg-muted/50"
        >
          <ExpandChevron expanded={expanded} />
        </button>
        <button
          type="button"
          onClick={handleCheckboxClick}
          className="flex flex-1 items-center gap-2 rounded px-1 py-1.5 text-left transition-colors hover:bg-muted/50"
        >
          <CheckboxIcon state={categoryState} />
          <span className="font-semibold">{cat.category}</span>
          <span className="text-xs text-muted-foreground">
            {enabledCount}/{codes.length}
          </span>
        </button>
      </div>
      {expanded && (
        <div className="ml-4 space-y-0.5">
          {cat.families.map((fam) => (
            <FamilyRow
              key={fam.family}
              family={fam}
              enabledTypes={enabledTypes}
              onToggleFamily={onToggleFamily}
              onToggleType={onToggleType}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AircraftTypeFilter() {
  const { enabledTypes, toggleType, toggleFamily, toggleCategory } =
    useAircraftFilter();

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Aircraft Type Filter</h3>
          <p className="text-xs text-muted-foreground">
            Select which aircraft types to show
          </p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {enabledTypes.size} types
        </span>
      </div>
      <div className="max-h-[400px] space-y-0.5 overflow-y-auto pr-1">
        {AIRCRAFT_TYPE_HIERARCHY.map((cat) => (
          <CategoryRow
            key={cat.category}
            cat={cat}
            enabledTypes={enabledTypes}
            onToggleCategory={toggleCategory}
            onToggleFamily={toggleFamily}
            onToggleType={toggleType}
          />
        ))}
      </div>
    </div>
  );
}
