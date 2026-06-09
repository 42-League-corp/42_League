// Mini-tendance de forme : suite de barres W (or) / nul (acier moyen) / L (sourd),
// de l'ancien au récent.
export function Sparkline({ form }: { form: Array<'W' | 'L' | 'D'> }) {
  const recent = form.slice(-7);
  if (recent.length === 0) {
    return <span className="text-[1.2vh] text-muted-2">—</span>;
  }
  return (
    <div className="flex items-end gap-[2px] h-[1.8vh]">
      {recent.map((r, i) => (
        <span
          key={i}
          className={`w-[0.5vh] rounded-sm ${r === 'W' ? 'bg-gold' : r === 'D' ? 'bg-steel' : 'bg-steel-dark'}`}
          style={{ height: r === 'W' ? '100%' : r === 'D' ? '70%' : '45%' }}
        />
      ))}
    </div>
  );
}
