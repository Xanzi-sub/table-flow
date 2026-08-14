"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";
import type { MenuScanJob } from "@/types/database";

const STATUS_BADGE: Record<MenuScanJob["status"], string> = {
  uploaded: "badge-neutral",
  processing: "badge-accent",
  needs_review: "badge-warning",
  published: "badge-success",
  failed: "badge-danger",
};

export function ScanJobStatusList({
  initialJobs,
}: {
  initialJobs: MenuScanJob[];
}) {
  const [jobs, setJobs] = useState(initialJobs);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("scan-jobs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_scan_jobs" },
        (payload) => {
          setJobs((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((j) => j.id !== (payload.old as MenuScanJob).id);
            }
            const updated = payload.new as MenuScanJob;
            const exists = prev.some((j) => j.id === updated.id);
            return exists
              ? prev.map((j) => (j.id === updated.id ? updated : j))
              : [updated, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold text-[var(--foreground)]">Scan Jobs</h2>
      <div className="mt-2 flex flex-col">
        {jobs.map((job) => (
          <div key={job.id} className="list-row">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                {job.image_urls.length} photo(s)
              </p>
              <p className="text-xs text-[var(--foreground-muted)]">
                {formatDateTime(job.created_at)}
              </p>
              {job.error_message && (
                <p className="text-xs text-[var(--danger-600)]">{job.error_message}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className={`badge capitalize ${STATUS_BADGE[job.status]}`}>
                {job.status.replace("_", " ")}
              </span>
              {(job.status === "needs_review" || job.status === "published") && (
                <Link
                  href={`/admin/menu-scan/${job.id}/review`}
                  className="text-sm font-semibold text-[var(--accent-600)] hover:underline"
                >
                  Review
                </Link>
              )}
            </div>
          </div>
        ))}
        {jobs.length === 0 && (
          <p className="py-6 text-center text-sm text-[var(--foreground-muted)]">
            No scan jobs yet.
          </p>
        )}
      </div>
    </div>
  );
}
