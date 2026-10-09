import { Construction } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import type { Permission } from '@/lib/auth/permissions';

export interface PlaceholderPageProps {
  currentPath: string;
  title: string;
  permission?: Permission;
  phase: number;
}

/** Página temporal hasta que se implemente la fase correspondiente. */
export default function PlaceholderPage({ currentPath, title, permission, phase }: PlaceholderPageProps) {
  return (
    <AppShell currentPath={currentPath} title={title} permission={permission}>
      <Card>
        <EmptyState
          icon={<Construction aria-hidden="true" />}
          title="Sección en construcción"
          description={`Esta pantalla se implementa en la Fase ${phase}.`}
          action={
            <a href="/design" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
              Ver sistema de diseño
            </a>
          }
        />
      </Card>
    </AppShell>
  );
}
