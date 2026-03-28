'use client';

export type DataSource = 'backend';

const NOOP = () => {};

export function useDataSource() {
  return { dataSource: 'backend' as const, setDataSource: NOOP };
}
