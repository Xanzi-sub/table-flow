"use client";

import { useRouter } from "next/navigation";
import { MenuScanUploader } from "./MenuScanUploader";
import { ScanJobStatusList } from "./ScanJobStatusList";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MenuScanJob } from "@/types/database";

export function MenuScanBoard({ initialJobs }: { initialJobs: MenuScanJob[] }) {
  const router = useRouter();

  return (
    <div>
      <PageHeader
        title="Menu Scan"
        description="Digitize a physical menu from photos, a PDF, or a spreadsheet."
      />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <MenuScanUploader onCreated={() => router.refresh()} />
        <ScanJobStatusList initialJobs={initialJobs} />
      </div>
    </div>
  );
}
