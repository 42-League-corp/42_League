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
    <div
      className={`inline-flex rounded-lg p-0.5 border border-gold/20 bg-bg-1/80 ${className}`}
      style={{
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,201,74,0.04)',
      }}
    >
      {choices.map((c) => {
        const active = c.value === value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className={
              'relative px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider rounded-md transition-all duration-200 ' +
              (active
                ? 'bg-gradient-to-b from-gold/25 to-gold/10 text-gold border border-gold/40 shadow-[inset_0_1px_0_rgba(255,247,228,0.18)]'
                : 'text-muted-2 hover:text-gold/90 border border-transparent')
            }
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
