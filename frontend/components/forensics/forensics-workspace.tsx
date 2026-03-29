"use client";

import { ForensicQuickView } from "@/components/forensics/forensic-quick-view";
import { ForensicsFilters } from "@/components/forensics/forensics-filters";
import { ForensicsTable } from "@/components/forensics/forensics-table";
import { useUIStore } from "@/store/ui-store";

type ForensicsWorkspaceProps = {
  title: string;
  description: string;
};

export function ForensicsWorkspace({
  title,
  description,
}: ForensicsWorkspaceProps) {
  const forensicsQuickViewOpen = useUIStore((state) => state.forensicsQuickViewOpen);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-6 py-8 pb-24 md:px-8 lg:px-10">
      <header className="mb-8">
        <h1 className="font-headline text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">{description}</p>
      </header>

      <ForensicsFilters />
      <ForensicsTable />
      {forensicsQuickViewOpen ? <ForensicQuickView /> : null}
    </div>
  );
}
