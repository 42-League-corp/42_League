interface Choice<V extends string> {
  value: V;
  label: string;
}

interface PillsProps<V extends string> {
  value: V;
  choices: Choice<V>[];
  onChange: (v: V) => void;
  className?: string;
}

export function Pills<V extends string>({
  value,
  choices,
  onChange,
  className = '',
}: PillsProps<V>) {
  return (
    <div className={`inline-flex bg-bg-2 rounded p-0.5 ${className}`}>
      {choices.map((c) => {
        const active = c.value === value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className={
              'px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded transition ' +
              (active
                ? 'bg-teal-deep/40 text-teal shadow-inner'
                : 'text-muted-2 hover:text-text')
            }
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
