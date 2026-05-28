/**
 * Quatre rivets dorés/laiton placés aux coins d'un conteneur — purement décoratif.
 *
 * Implémentation : 4 spans absolus avec un `background: radial-gradient(...)`
 * en CSS pour simuler le bombé doré. Plus simple et plus performant qu'un SVG :
 *   - Pas d'ID partagé entre instances (les IDs SVG sont globaux et collisionnent)
 *   - Pas de tag SVG à parser, juste deux divs imbriqués
 *   - Rendu identique à toutes les densités d'écran
 *
 * `pointer-events-none` → le composant ne capte aucun clic.
 */
export function RivetCorners({
  size = 8,
  inset = 6,
}: {
  /** Diamètre du rivet en px. */
  size?: number;
  /** Distance entre le rivet et le bord du conteneur en px. */
  inset?: number;
}) {
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none">
      <Rivet size={size} pos={{ top: inset, left: inset }} />
      <Rivet size={size} pos={{ top: inset, right: inset }} />
      <Rivet size={size} pos={{ bottom: inset, left: inset }} />
      <Rivet size={size} pos={{ bottom: inset, right: inset }} />
    </div>
  );
}

interface RivetProps {
  size: number;
  pos: { top?: number; bottom?: number; left?: number; right?: number };
}

function Rivet({ size, pos }: RivetProps) {
  return (
    <span
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        ...pos,
        background:
          'radial-gradient(circle at 35% 30%, #fff7e4 0%, #f5d27a 35%, #8a5e10 70%, #2a1f12 100%)',
        boxShadow:
          'inset 0 0 0 0.5px rgba(0,0,0,0.6), 0 0 2px rgba(0,0,0,0.55), 0 0 4px rgba(255,201,74,0.3)',
      }}
    />
  );
}
