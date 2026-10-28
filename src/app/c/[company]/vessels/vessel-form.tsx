"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveVessel, type VesselFormState } from "@/lib/actions/vessels";
import type { VesselRow } from "@/lib/data/vessels";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton, secondaryButtonSm } from "@/components/ui";

const TYPES = ["Motor yacht", "Sailing yacht", "Catamaran", "Fishing boat", "RIB / tender", "Jet ski", "Commercial vessel", "Other"];
const POSITIONS = ["Port", "Starboard", "Main", "Centre", "Generator", "Outboard", "Bow thruster"];

type Engine = { key: string; id?: string; position: string; make: string; model: string; serialNumber: string; year: string; hours: string };
const blankEngine = (position = "Port"): Engine => ({ key: crypto.randomUUID(), position, make: "", model: "", serialNumber: "", year: "", hours: "" });

export function VesselForm({ companySlug, vessel, customers, defaultCustomerId }: { companySlug: string; vessel?: VesselRow; customers: { id: string; name: string }[]; defaultCustomerId?: string }) {
  const [state, formAction, pending] = useActionState<VesselFormState, FormData>(saveVessel.bind(null, companySlug, vessel?.id ?? null), {});
  const nameInput = useFocusOnShow<HTMLInputElement>();
  const [engines, setEngines] = useState<Engine[]>(() =>
    vessel?.engines.length
      ? vessel.engines.map((e) => ({
          key: e.id,
          id: e.id,
          position: e.position,
          make: e.make ?? "",
          model: e.model ?? "",
          serialNumber: e.serialNumber ?? "",
          year: e.year?.toString() ?? "",
          hours: e.hours?.toString() ?? "",
        }))
      : [],
  );
  const set = (key: string, patch: Partial<Engine>) => setEngines((es) => es.map((e) => (e.key === key ? { ...e, ...patch } : e)));

  return (
    <form
      action={(fd) => {
        const field = (k: string) => String(fd.get(k) ?? "");
        fd.set(
          "payload",
          JSON.stringify({
            name: field("name"),
            customerId: field("customerId"),
            type: field("type"),
            make: field("make"),
            model: field("model"),
            lengthM: field("lengthM"),
            year: field("year"),
            registration: field("registration"),
            hullNumber: field("hullNumber"),
            homePort: field("homePort"),
            notes: field("notes"),
            engines: engines.map(({ id, position, make, model, serialNumber, year, hours }) => ({ id, position, make, model, serialNumber, year, hours })),
          }),
        );
        return formAction(fd);
      }}
      data-save-shortcut
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Vessel name *
          <input ref={nameInput} name="name" required maxLength={120} defaultValue={vessel?.name} placeholder="e.g. Blue Pearl" className={inputClass} />
        </label>
        <label className={labelClass}>
          Owner (customer)
          <select name="customerId" defaultValue={vessel?.customer?.id ?? defaultCustomerId ?? ""} className={inputClass}>
            <option value="">— Not set —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Type
          <select name="type" defaultValue={vessel?.type ?? ""} className={inputClass}>
            <option value="">—</option>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Builder / make
            <input name="make" maxLength={80} defaultValue={vessel?.make ?? ""} placeholder="e.g. Sunseeker" className={inputClass} />
          </label>
          <label className={labelClass}>
            Model
            <input name="model" maxLength={80} defaultValue={vessel?.model ?? ""} placeholder="e.g. Manhattan 52" className={inputClass} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Length (m)
            <input name="lengthM" type="number" step="0.01" min="0" defaultValue={vessel?.lengthM ?? ""} className={inputClass} />
          </label>
          <label className={labelClass}>
            Year built
            <input name="year" type="number" min="1900" max="2100" defaultValue={vessel?.year ?? ""} className={inputClass} />
          </label>
        </div>
        <label className={labelClass}>
          Home port / marina
          <input name="homePort" maxLength={120} defaultValue={vessel?.homePort ?? ""} placeholder="e.g. Jounieh" className={inputClass} />
        </label>
        <label className={labelClass}>
          Registration / flag no.
          <input name="registration" maxLength={80} defaultValue={vessel?.registration ?? ""} className={inputClass} />
        </label>
        <label className={labelClass}>
          Hull ID (HIN)
          <input name="hullNumber" maxLength={80} defaultValue={vessel?.hullNumber ?? ""} className={inputClass} />
        </label>
      </div>

      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-navy">Engines</h3>
          <button type="button" onClick={() => setEngines((es) => [...es, blankEngine(es.length === 0 ? "Port" : es.length === 1 ? "Starboard" : "Generator")])} className={secondaryButtonSm}>
            <Plus className="size-3.5" aria-hidden /> Add engine
          </button>
        </div>
        {engines.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No engines recorded.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {engines.map((e, i) => (
              <div key={e.key} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-2 sm:grid-cols-[7rem_1fr_1fr_1fr_5rem_5rem_2rem]">
                <select value={e.position} onChange={(ev) => set(e.key, { position: ev.target.value })} aria-label={`Engine ${i + 1} position`} className={`${inputClass} h-9`}>
                  {[...new Set([...POSITIONS, e.position])].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <input value={e.make} onChange={(ev) => set(e.key, { make: ev.target.value })} placeholder="Make (e.g. Volvo Penta)" aria-label={`Engine ${i + 1} make`} className={`${inputClass} h-9`} />
                <input value={e.model} onChange={(ev) => set(e.key, { model: ev.target.value })} placeholder="Model" aria-label={`Engine ${i + 1} model`} className={`${inputClass} h-9`} />
                <input value={e.serialNumber} onChange={(ev) => set(e.key, { serialNumber: ev.target.value })} placeholder="Serial no." aria-label={`Engine ${i + 1} serial number`} className={`${inputClass} h-9`} />
                <input value={e.year} onChange={(ev) => set(e.key, { year: ev.target.value })} placeholder="Year" inputMode="numeric" aria-label={`Engine ${i + 1} year`} className={`${inputClass} h-9`} />
                <input value={e.hours} onChange={(ev) => set(e.key, { hours: ev.target.value })} placeholder="Hours" inputMode="numeric" aria-label={`Engine ${i + 1} hours`} className={`${inputClass} h-9`} />
                <button type="button" onClick={() => setEngines((es) => es.filter((x) => x.key !== e.key))} title="Remove engine" aria-label={`Remove engine ${i + 1}`} className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-red-50 hover:text-danger">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <label className={labelClass}>
        Notes
        <textarea name="notes" rows={2} maxLength={2000} defaultValue={vessel?.notes ?? ""} className={inputClass} />
      </label>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Saving…" : vessel ? "Save vessel" : "Add vessel"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}
