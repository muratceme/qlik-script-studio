import { SplitLayout } from './SplitLayout';
import { RelationsCanvas } from '@/features/relations/RelationsCanvas';

export function TabRelations() {
  return (
    <SplitLayout>
      <RelationsCanvas />
    </SplitLayout>
  );
}
