"use client";

import { useState } from "react";
import { labelClass, inputClass } from "@/components/ui";
import { InvoiceJobForm } from "../workshop/[jobId]/job-actions";

export type JobToInvoice = { id: string; number: string; customerName: string; amount: string };

/** Choose a job card with work not invoiced yet, then invoice its billable lines. */
export function JobInvoicePicker({ companySlug, jobs }: { companySlug: string; jobs: JobToInvoice[] }) {
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return <p className="text-sm text-muted">No job cards are waiting to be invoiced.</p>;
  return (
    <div className="space-y-4">
      <label className={labelClass}>
        Job card *
        <select value={jobId} onChange={(e) => setJobId(e.target.value)} className={inputClass}>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.number} · {j.customerName}
            </option>
          ))}
        </select>
      </label>
      <InvoiceJobForm key={job.id} companySlug={companySlug} jobId={job.id} amount={job.amount} />
    </div>
  );
}
