import type { ReactNode } from "react";

export function Panel({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>{title}</h2>
        {aside}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, wide }: { label: string; hint?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`field ${wide ? "wide" : ""}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  allowEmpty,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  allowEmpty?: boolean;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(clamp((value ?? min) - step))} disabled={value !== null && value <= min}>
        &minus;
      </button>
      <input
        type="number"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          if (e.target.value === "") return onChange(allowEmpty ? null : min);
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(clamp(n));
        }}
      />
      <button type="button" onClick={() => onChange(clamp((value ?? min - step) + step))} disabled={value !== null && value >= max}>
        +
      </button>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-box" aria-hidden />
      <span>{label}</span>
    </label>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          className={o.value === value ? "on" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}