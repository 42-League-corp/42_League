import { useEffect, useState } from 'react';
import { api, type ShopItemData, type TournamentPrize } from '../../lib/api';
import { ItemFormFields, buildInput, emptyForm, type FormState } from '../shop/CosmeticForm';

// ─────────────────────────────────────────────────────────────────────────────
// TournamentPrizePicker — config de récompense d'un tournoi officiel (admin).
// Une seule récompense : aucune | League Coins | cosmétique existant | cosmétique
// custom créé à la volée (réutilise le formulaire ShopGOD). Responsive (vertical),
// utilisé en desktop ET mobile.
// ─────────────────────────────────────────────────────────────────────────────

export type PrizeFormState =
  | { kind: 'none' }
  | { kind: 'coins'; coins: string }
  | { kind: 'existing'; itemId: string }
  | { kind: 'new'; form: FormState };

export const EMPTY_PRIZE: PrizeFormState = { kind: 'none' };

/** Convertit l'état UI → payload API. Lève une Error explicite si invalide. */
export function buildPrizePayload(state: PrizeFormState): TournamentPrize {
  switch (state.kind) {
    case 'none':
      return { kind: 'none' };
    case 'coins': {
      const coins = Math.floor(Number(state.coins) || 0);
      if (coins < 1) throw new Error('Le montant de League Coins doit être ≥ 1.');
      return { kind: 'coins', coins };
    }
    case 'existing': {
      if (!state.itemId) throw new Error('Choisis un cosmétique existant.');
      return { kind: 'existingItem', itemId: state.itemId };
    }
    case 'new':
      // buildInput lève si le cosmétique est incomplet (nom, titre, etc.).
      return { kind: 'newCosmetic', cosmetic: buildInput(state.form) };
  }
}

const KINDS: { value: PrizeFormState['kind']; label: string }[] = [
  { value: 'none', label: 'Aucune' },
  { value: 'coins', label: 'League Coins' },
  { value: 'existing', label: 'Cosmétique existant' },
  { value: 'new', label: 'Cosmétique custom' },
];

export function TournamentPrizePicker({
  value,
  onChange,
}: {
  value: PrizeFormState;
  onChange: (v: PrizeFormState) => void;
}) {
  const [items, setItems] = useState<ShopItemData[] | null>(null);

  // Charge le catalogue à la première sélection « cosmétique existant ».
  useEffect(() => {
    if (value.kind === 'existing' && items === null) {
      void api
        .adminShopItems()
        .then((list) => setItems(list))
        .catch(() => setItems([]));
    }
  }, [value.kind, items]);

  const pick = (kind: PrizeFormState['kind']) => {
    if (kind === value.kind) return;
    if (kind === 'none') onChange({ kind: 'none' });
    else if (kind === 'coins') onChange({ kind: 'coins', coins: '100' });
    else if (kind === 'existing') onChange({ kind: 'existing', itemId: '' });
    else onChange({ kind: 'new', form: emptyForm() });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Choix du type de récompense */}
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => {
          const on = value.kind === k.value;
          return (
            <button
              key={k.value}
              type="button"
              onClick={() => pick(k.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-colors ${
                on
                  ? 'bg-gold/15 border-gold/40 text-gold'
                  : 'bg-bg-2/40 border-border/60 text-muted-2 hover:text-text'
              }`}
            >
              {k.label}
            </button>
          );
        })}
      </div>

      {/* Montant de coins */}
      {value.kind === 'coins' && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-2 font-bold">
            Montant (League Coins)
          </span>
          <input
            type="number"
            min={1}
            value={value.coins}
            onChange={(e) => onChange({ kind: 'coins', coins: e.target.value })}
            className="bg-bg-2 border border-border rounded-lg px-3 py-2 text-sm tabular-nums text-text focus:outline-none focus:border-gold/40"
          />
        </label>
      )}

      {/* Cosmétique existant */}
      {value.kind === 'existing' && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-2 font-bold">
            Cosmétique du catalogue
          </span>
          {items === null ? (
            <span className="text-xs text-muted-2 py-2">Chargement…</span>
          ) : items.length === 0 ? (
            <span className="text-xs text-muted-2 py-2">Aucun cosmétique disponible.</span>
          ) : (
            <select
              value={value.itemId}
              onChange={(e) => onChange({ kind: 'existing', itemId: e.target.value })}
              className="bg-bg-2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-gold/40"
            >
              <option value="">— choisir —</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  [{it.category}] {it.name}
                </option>
              ))}
            </select>
          )}
        </label>
      )}

      {/* Cosmétique custom — formulaire ShopGOD réutilisé (thème sombre dédié). */}
      {value.kind === 'new' && (
        <div className="rounded-xl border border-border/60 bg-zinc-950/60 p-3">
          <ItemFormFields
            form={value.form}
            set={(k, v) => onChange({ kind: 'new', form: { ...value.form, [k]: v } })}
          />
          <p className="mt-2 text-[11px] text-muted-2">
            Ce cosmétique est <span className="text-gold font-bold">exclusif au tournoi</span> : il
            n'apparaîtra jamais en boutique et sera remis au vainqueur.
          </p>
        </div>
      )}
    </div>
  );
}
