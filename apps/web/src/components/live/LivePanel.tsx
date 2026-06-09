// Titre de panneau partagé par les encarts de l'écran TV live.
export function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[0.6vw] px-[1vw] py-[1vh] shrink-0">
      <span className="inline-block w-[0.4vw] h-[2vh] bg-gradient-to-b from-gold to-gold-deep rounded-sm" />
      <h2 className="font-gaming font-bold uppercase tracking-[0.12em] text-[1.9vh] text-text-strong">
        {children}
      </h2>
    </div>
  );
}
