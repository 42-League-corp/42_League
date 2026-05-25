type Tone = 'teal' | 'win' | 'loss' | 'neutral';

interface StatCardProps {
  value: string;
  label: string;
  tone?: Tone;
}

const TONE: Record<Tone, string> = {
  teal: 'text-teal',
  win: 'text-gold',
  loss: 'text-red',
  neutral: 'text-text-strong',
};

export function StatCard({ value, label, tone = 'neutral' }: StatCardProps) {
  return (
    <div className="bg-bg-2 border border-border rounded p-3 text-center">
      <div className={`text-2xl font-extrabold tabular-nums leading-none ${TONE[tone]}`}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-2 mt-1.5 font-semibold">
        {label}
      </div>
    </div>
  );
}
