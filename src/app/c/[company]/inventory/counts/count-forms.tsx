"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { deleteStockCount, postStockCount, saveStockCount, startStockCount, type StockFormState } from "@/lib/actions/stock-ops";
import type { StockCountRow } from "@/lib/data/stock-ops";
import { formatMoney, round2 } from "@/lib/money";
import { useFeedback } from "@/components/feedback";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, StickyActions, cardClass, inputClass, labelClass, primaryButton, secondaryButton } from "@/components/ui";

export function NewCountForm({ companySlug }: { companySlug: string }) {
  const [state, formAction, pending] = useActionState<StockFormState, FormData>(startStockCount.bind(null, companySlug), {});
  const input = useFocusOnShow<HTMLInputElement>();
  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      <label className={labelClass}>
        Only products matching (optional)
        <input ref={input} name="filter" maxLength={100} placeholder="Name, code or supplier — empty counts everything" className={inputClass} />
      </label>
      <label className={labelClass}>
        Note
        <input name="notes" maxLength={1000} placeholder="e.g. Year-end count, shelf A" className={inputClass} />
      </label>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Preparing…" : "Start count"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}

/** Enter what's on the shelf; differences and their value show as you type. */
export function CountSheet({ companySlug, count }: { companySlug: string; count: StockCountRow }) {
  const [state, formAction, pending] = useActionState<StockFormState, FormData>(saveStockCount.bind(null, companySlug, count.id), {});
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(count.lines.map((l) => [l.id, l.counted === null ? "" : String(l.counted)])));
  const [filter, setFilter] = useState("");
  const [dirty, setDirty] = useState(false);
  const search = useFocusOnShow<HTMLInputElement>();
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return count.lines.filter((l) => !q || l.name.toLowerCase().includes(q) || l.code.startsWith(q));
  }, [count.lines, filter]);
  const counted = count.lines.filter((l) => values[l.id] !== "");
  const diffValue = round2(counted.reduce((s, l) => s + (Number(values[l.id]) - l.expected) * l.priceHT, 0));

  return (
    <form
      action={(fd) => {
        fd.set("payload", JSON.stringify(count.lines.map((l) => ({ id: l.id, counted: values[l.id] === "" ? null : Math.max(0, Math.round(Number(values[l.id]))) }))));
        return formAction(fd);
      }}
      data-save-shortcut
      data-dirty={dirty ? "true" : undefined}
    >
      <input
        ref={search}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        placeholder="Find a product by name or code…"
        aria-label="Find a product"
        className={`${inputClass} max-w-md`}
      />
      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-2.5">Product</th>
              <th className="px-4 py-2.5 text-right">System</th>
              <th className="w-32 px-4 py-2.5 text-right">Counted</th>
              <th className="px-4 py-2.5 text-right">Difference</th>
              <th className="px-4 py-2.5 text-right">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((l) => {
              const v = values[l.id];
              const diff = v === "" ? null : Number(v) - l.expected;
              return (
                <tr key={l.id}>
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs text-muted">{l.code}</span> <span className="font-medium text-navy">{l.name}</span>
                  </td>
                  <td className="tabular px-4 py-2 text-right text-muted">{l.expected}</td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={v}
                      onChange={(e) => {
                        setDirty(true);
                        setValues((x) => ({ ...x, [l.id]: e.target.value }));
                      }}
                      onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                      aria-label={`Counted ${l.name}`}
                      className={`${inputClass} h-9 w-24 text-right tabular`}
                    />
                  </td>
                  <td className={`tabular px-4 py-2 text-right font-medium ${diff === null || diff === 0 ? "text-muted" : diff < 0 ? "text-danger" : "text-success"}`}>
                    {diff === null ? "—" : diff > 0 ? `+${diff}` : diff}
                  </td>
                  <td className="tabular px-4 py-2 text-right text-muted">{diff ? formatMoney(diff * l.priceHT) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <FormMessage error={state.error} />
      </div>
      <StickyActions
        summary={
          <span>
            {counted.length} of {count.lines.length} counted · difference{" "}
            <span className={`font-semibold ${diffValue < 0 ? "text-danger" : "text-navy"}`}>{formatMoney(diffValue)}</span> at selling price excl. VAT
          </span>
        }
      >
        <button type="submit" disabled={pending} className={`${primaryButton} gap-2`}>
          {pending ? "Saving…" : "Save"}
          <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
        </button>
      </StickyActions>
    </form>
  );
}

export function CountActions({ companySlug, countId, number }: { companySlug: string; countId: string; number: string }) {
  const [pending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        className={primaryButton}
        onClick={async () => {
          const ok = await confirm({
            title: `Post count ${number}?`,
            message: "Save first. Each counted product's stock is set to the counted quantity. Products left empty are not changed. This can't be undone.",
            confirmLabel: "Post count",
          });
          if (!ok) return;
          startTransition(async () => {
            const res = await postStockCount(companySlug, countId);
            if (res.error) toast.error(res.error);
            else toast.success("Count posted. Stock updated.");
          });
        }}
      >
        <CheckCircle2 className="size-4" aria-hidden /> Post count
      </button>
      <button
        type="button"
        disabled={pending}
        title="Delete count"
        aria-label="Delete count"
        className={`${secondaryButton} w-10 px-0 text-muted hover:text-danger`}
        onClick={async () => {
          if (!(await confirm({ title: `Delete count ${number}?`, message: "Nothing has been changed in the stock yet.", confirmLabel: "Delete", tone: "danger" }))) return;
          startTransition(async () => {
            try {
              const res = await deleteStockCount(companySlug, countId);
              if (res?.error) toast.error(res.error);
            } catch (e) {
              if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
              toast.error("The count couldn't be deleted.");
            }
          });
        }}
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </>
  );
}
