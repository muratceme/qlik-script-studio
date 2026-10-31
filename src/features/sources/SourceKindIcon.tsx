import { Database, FileSpreadsheet, FileText, ListOrdered, Package } from 'lucide-react';
import type { SourceKind } from '@/model/types';

const ICONS = {
  qvd: Package,
  excel: FileSpreadsheet,
  csv: FileText,
  sql: Database,
  inline: ListOrdered,
} as const;

export function SourceKindIcon({ kind, className }: { kind: SourceKind; className?: string }) {
  const Icon = ICONS[kind];
  return <Icon className={className} aria-hidden="true" />;
}
