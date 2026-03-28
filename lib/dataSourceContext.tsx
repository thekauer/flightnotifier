'use client';

import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from 'react';

export type DataSource = 'backend' | 'fallback';

interface DataSourceContextValue {
  dataSource: DataSource;
  setDataSource: (source: DataSource) => void;
}

const DataSourceContext = createContext<DataSourceContextValue>({
  dataSource: 'backend',
  setDataSource: () => {},
});

const STORAGE_KEY = 'flightnotifier-datasource';

function readStoredSource(): DataSource {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'fallback') return 'fallback';
  } catch {
    // localStorage may not be available
  }
  return 'backend';
}

export function DataSourceProvider({ children }: { children: ReactNode }) {
  // Always initialize with default to avoid SSR/client hydration mismatch.
  // localStorage is read lazily on first interaction via setDataSource or getDataSource.
  const [dataSource, setDataSourceState] = useState<DataSource>('backend');
  const hasSynced = useRef(false);

  // Lazily sync from localStorage on first read (client-only)
  const getSyncedSource = useCallback((): DataSource => {
    if (!hasSynced.current && typeof window !== 'undefined') {
      hasSynced.current = true;
      const stored = readStoredSource();
      if (stored !== 'backend') {
        setDataSourceState(stored);
      }
      return stored;
    }
    return dataSource;
  }, [dataSource]);

  const setDataSource = useCallback((source: DataSource) => {
    hasSynced.current = true;
    setDataSourceState(source);
    try {
      localStorage.setItem(STORAGE_KEY, source);
    } catch {
      // ignore write errors
    }
  }, []);

  // Read localStorage on first provider render on client
  const currentSource = getSyncedSource();

  return (
    <DataSourceContext.Provider value={{ dataSource: currentSource, setDataSource }}>
      {children}
    </DataSourceContext.Provider>
  );
}

export function useDataSource(): DataSourceContextValue {
  return useContext(DataSourceContext);
}
