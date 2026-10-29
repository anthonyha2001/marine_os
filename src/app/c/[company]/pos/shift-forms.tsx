"use client";

import { useActionState, useState } from "react";
import { closeShift, openShift, setExchangeRate, type PosFormState } from "@/lib/actions/pos";
import { formatMoney, round2 } from "@/lib/money";
import { formatLbp, formatRate } from "@/lib/pos";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton } from "@/components/ui";

const num = (v: string) => Number(v.replace(/,/g, "")) || 0;

export function RateForm({ companySlug, current }: { companySlug: string; current: number | null }) {
  const [state, formAction, pending] = useActionState<PosFormState, FormData>(setExchangeRate.bind(null, companySlug), {});
  const input = useFocusOnShow<HTMLInputElement>();
  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      <label className={labelClass}>
        LBP for 1 USD *
        <input ref={input} name="lbpPerUsd" required inputMode="numeric" defaultValue={current ?? ""} placeholder="e.g. 89500" className={`${inputClass} tabular text-lg`} />
      </label>
      {current && <p className="text-sm text-muted">Current rate: {formatRate(current)}. Sales already made keep the rate they were made at.</p>}
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Saving…" : "Save rate"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}

export function OpenShiftForm({ companySlug }: { companySlug: string }) {
  const [state, formAction, pending] = useActionState<PosFormState, FormData>(openShift.bind(null, companySlug), {});
  const input = useFocusOnShow<HTMLInputElement>();
  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      <p className="text-sm text-muted">Count the cash in the drawer before the first sale. This is the float you start with.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          USD in the drawer *
          <input ref={input} name="openingUsd" required inputMode="decimal" defaultValue="0" className={`${inputClass} tabular text-lg`} />
        </label>
        <label className={labelClass}>
          LBP in the drawer *
          <input name="openingLbp" required inputMode="numeric" defaultValue="0" className={`${inputClass} tabular text-lg`} />
        </label>
      </div>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} h-12 w-full gap-2 text-base`}>
        {pending ? "Opening…" : "Open the till"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}

export function CloseShiftForm({
  companySlug,
  shiftId,
  expectedUsd,
  expectedLbp,
  rate,
  blind = false,
}: {
  companySlug: string;
  shiftId: string;
  expectedUsd: number;
  expectedLbp: number;
  rate: number;
  /** Count without seeing what the drawer should hold (set in the POS settings). */
  blind?: boolean;
}) {
  const [state, formAction, pending] = useActionState<PosFormState, FormData>(closeShift.bind(null, companySlug, shiftId), {});
  const [usd, setUsd] = useState("");
  const [lbp, setLbp] = useState("");
  const input = useFocusOnShow<HTMLInputElement>();
  const diffUsd = round2(num(usd) - expectedUsd);
  const diffLbp = Math.round(num(lbp) - expectedLbp);
  const total = round2(diffUsd + diffLbp / rate);
  const counted = usd !== "" && lbp !== "";

  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      {blind ? (
        <p className="rounded-lg bg-background p-3 text-sm text-muted">Count the USD and LBP in the drawer and enter what you counted.</p>
      ) : (
        <div className="rounded-lg bg-background p-3 text-sm">
          <p className="font-medium text-navy">The drawer should hold</p>
          <p className="tabular mt-1">
            {formatMoney(expectedUsd)} and {formatLbp(expectedLbp)}
          </p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          USD counted *
          <input ref={input} name="countedUsd" required inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} className={`${inputClass} tabular text-lg`} />
          {!blind && usd !== "" && diffUsd !== 0 && <span className={`mt-1 block text-xs ${diffUsd < 0 ? "text-danger" : "text-success"}`}>{diffUsd < 0 ? "Short" : "Over"} {formatMoney(Math.abs(diffUsd))}</span>}
        </label>
        <label className={labelClass}>
          LBP counted *
          <input name="countedLbp" required inputMode="numeric" value={lbp} onChange={(e) => setLbp(e.target.value)} className={`${inputClass} tabular text-lg`} />
          {!blind && lbp !== "" && diffLbp !== 0 && <span className={`mt-1 block text-xs ${diffLbp < 0 ? "text-danger" : "text-success"}`}>{diffLbp < 0 ? "Short" : "Over"} {formatLbp(Math.abs(diffLbp))}</span>}
        </label>
      </div>
      {counted && !blind && (
        <p className={`text-sm font-medium ${total === 0 ? "text-success" : total < 0 ? "text-danger" : "text-amber-700"}`}>
          {total === 0 ? "The till balances." : `Difference: ${total < 0 ? "short" : "over"} ${formatMoney(Math.abs(total))} in total — it will be booked as ${total < 0 ? "a loss" : "other income"}.`}
        </p>
      )}
      <label className={labelClass}>
        Note
        <textarea name="notes" rows={2} maxLength={1000} className={inputClass} />
      </label>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending || !counted} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Closing…" : "Close the shift"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}
