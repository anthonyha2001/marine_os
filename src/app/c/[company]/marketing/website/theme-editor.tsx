"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { saveTheme } from "@/lib/actions/website-pages";
import { BODY_FONTS, DEFAULT_THEME, HEADING_FONTS, type Theme } from "@/lib/website-theme";
import { useFeedback } from "@/components/feedback";
import { Kbd, cardClass, inputClass, labelClass, primaryButton, secondaryButton } from "@/components/ui";

const COLORS: [keyof Theme, string, string][] = [
  ["navy", "Deep colour", "Dark sections, header, footer, titles"],
  ["gold", "Accent", "Buttons, small titles, highlights"],
  ["cream", "Light background", "Light sections"],
  ["ink", "Text", "Body text on light sections"],
];
const CHOICES: { key: keyof Theme; label: string; options: [string, string][] }[] = [
  { key: "headingFont", label: "Titles font", options: Object.entries(HEADING_FONTS) },
  { key: "bodyFont", label: "Text font", options: Object.entries(BODY_FONTS) },
  { key: "corners", label: "Corners", options: [["sharp", "Sharp"], ["soft", "Soft"], ["round", "Round"]] },
  { key: "buttons", label: "Buttons", options: [["solid", "Filled"], ["outline", "Outline"]] },
  { key: "header", label: "Menu bar", options: [["glass", "Transparent, turns to glass when scrolling"], ["solid", "Always solid"]] },
  { key: "motion", label: "Animations", options: [["full", "Gentle fade-in"], ["calm", "Minimal"], ["off", "None"]] },
];

/** Marketing → Website → Design: the site's colours, fonts, corners and motion. */
export function ThemeEditor({ companySlug, theme, siteBase }: { companySlug: string; theme: Theme; siteBase: string }) {
  const [t, setT] = useState<Theme>(theme);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [previewKey, setPreviewKey] = useState(0);
  const { toast } = useFeedback();
  const set = <K extends keyof Theme>(k: K, v: Theme[K]) => {
    setT((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };
  const radius = { sharp: "0px", soft: "14px", round: "28px" }[t.corners];

  return (
    <div className="grid gap-4 xl:grid-cols-[24rem_1fr]">
      <form
        data-save-shortcut
        data-dirty={dirty ? "true" : undefined}
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveTheme(companySlug, t);
            if (r.error) toast.error(r.error);
            else {
              toast.success("Design saved. The website is updated.");
              setDirty(false);
              setPreviewKey((k) => k + 1);
            }
          });
        }}
        className={`${cardClass} h-fit space-y-5 p-5`}
      >
        <div className="grid grid-cols-2 gap-4">
          {COLORS.map(([key, label, hint]) => (
            <label key={key} className={labelClass}>
              {label}
              <span className="mt-1.5 flex items-center gap-2">
                <input type="color" value={t[key] as string} onChange={(e) => set(key, e.target.value as never)} className="h-10 w-12 cursor-pointer rounded-md border border-border bg-surface p-1" />
                <input value={t[key] as string} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && set(key, e.target.value as never)} maxLength={7} className={`${inputClass} mt-0 font-mono text-xs`} aria-label={`${label} code`} />
              </span>
              <span className="mt-1 block text-[11px] font-normal text-muted">{hint}</span>
            </label>
          ))}
        </div>
        {CHOICES.map((c) => (
          <label key={c.key} className={labelClass}>
            {c.label}
            <select value={t[c.key] as string} onChange={(e) => set(c.key, e.target.value as never)} className={inputClass}>
              {c.options.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        ))}

        {/* A small live sample, before saving */}
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="p-4" style={{ background: t.navy }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em]" style={{ color: t.gold }}>
              Sample
            </p>
            <p className="mt-1 text-2xl text-white" style={{ fontFamily: HEADING_FONTS[t.headingFont] }}>
              Propellers built for performance
            </p>
            <span className="mt-3 inline-block px-4 py-2 text-xs font-semibold" style={{ background: t.buttons === "outline" ? "transparent" : t.gold, color: t.buttons === "outline" ? t.gold : t.navy, border: `1px solid ${t.gold}`, borderRadius: radius }}>
              Book an appointment
            </span>
          </div>
          <div className="p-4 text-sm" style={{ background: t.cream, color: t.ink, fontFamily: BODY_FONTS[t.bodyFont] }}>
            Supply, fitting, repair and balancing of propellers, shafts and running gear.
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setT(DEFAULT_THEME);
              setDirty(true);
            }}
            className={secondaryButton}
          >
            <RotateCcw className="size-4" aria-hidden /> Default
          </button>
          <button type="submit" disabled={pending || !dirty} className={`${primaryButton} gap-2`}>
            {pending ? "Saving…" : "Save design"} <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
          </button>
        </div>
      </form>
      <section className={`${cardClass} overflow-hidden`}>
        <p className="border-b border-border px-4 py-2 text-sm font-medium text-navy">Preview (after saving)</p>
        <iframe key={previewKey} src={siteBase} title="Website preview" className="h-[78vh] w-full border-0" />
      </section>
    </div>
  );
}
