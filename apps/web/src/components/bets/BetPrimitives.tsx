import { useState } from 'react';
import type { BetStatus } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { Avatar } from '../Avatar';

/** Cote fixe des paris : un pari gagnant rapporte 2× la mise. */
export const BET_MULTIPLIER = 2;

/** Petit montant en coins avec l'icône 42coin. */
export function CoinAmount({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <img src="/42coin.png" alt="" className="w-4 h-4" />
      {value}
    </span>
  );
}

/** Petit badge de discipline (ex. STREETFIGHTER). */
export function GameTag({ game }: { game: string | null }) {
  if (!game) return null;
  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-extrabold bg-white/5 text-muted-2">
      {game}
    </span>
  );
}

/** Classe d'un badge de statut de pari (ouvert / gagné / perdu / remboursé). */
export function betStatusStyle(status: BetStatus): string {
  switch (status) {
    case 'won':
      return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300';
    case 'lost':
      return 'border-red/25 bg-red/10 text-red';
    case 'refunded':
      return 'border-sky-400/25 bg-sky-400/10 text-sky-300';
    default:
      return 'border-gold/25 bg-gold/10 text-gold';
  }
}

/**
 * Formulaire inline de placement de pari : choix d'un pronostic parmi `choices`
 * + saisie de la mise (bornée au solde). Partagé entre l'onglet Paris du profil
 * et l'onglet Parier d'un tournoi.
 */
export function BetForm({
  choices,
  avatars,
  maxStake,
  busy,
  onSubmit,
  onCancel,
}: {
  choices: string[];
  /** Map login → URL de photo, pour afficher la pp à côté de chaque choix. */
  avatars?: Record<string, string | null>;
  maxStake: number;
  busy: boolean;
  onSubmit: (choiceLogin: string, stake: number) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [choice, setChoice] = useState<string>('');
  const [stake, setStake] = useState<string>('');
  const stakeNum = Number(stake);
  const valid = !!choice && Number.isInteger(stakeNum) && stakeNum > 0 && stakeNum <= maxStake;

  return (
    <div className="mt-3 pt-3 border-t border-gold/10 space-y-3">
      <div>
        <div className="text-[10px] uppercase tracking-[0.16em] font-extrabold text-muted-2 mb-2">
          {t('bets.chooseWinner')}
        </div>
        <div className="flex flex-wrap gap-2">
          {choices.map((login) => {
            const active = login === choice;
            const hasAvatar = avatars !== undefined;
            return (
              <button
                key={login}
                type="button"
                onClick={() => setChoice(login)}
                className={`flex items-center gap-2 ${hasAvatar ? 'pl-1.5 pr-3' : 'px-3'} h-8 rounded-lg text-xs font-bold tap-transparent transition-colors ${
                  active
                    ? 'border border-gold/50 bg-gold/20 text-gold'
                    : 'border border-white/8 bg-white/[0.02] text-muted hover:text-text'
                }`}
              >
                {hasAvatar && <Avatar login={login} imageUrl={avatars[login] ?? null} size="xs" />}
                @{login}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            min={1}
            max={maxStake}
            inputMode="numeric"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            placeholder={t('bets.stake')}
            className="w-full h-9 rounded-xl bg-bg-2/80 border border-gold/15 px-3 text-sm text-text-strong tabular-nums outline-none focus:border-gold/40"
          />
        </div>
        {valid && (
          <span className="text-[11px] text-muted-2 shrink-0">
            {t('bets.potentialGain')}{' '}
            <CoinAmount value={stakeNum * BET_MULTIPLIER} className="text-gold font-bold" />
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-9 rounded-xl border border-white/8 bg-white/[0.02] text-muted-2 text-xs font-extrabold uppercase tracking-[0.14em] tap-transparent"
        >
          {t('bets.cancel')}
        </button>
        <button
          type="button"
          disabled={!valid || busy}
          onClick={() => onSubmit(choice, stakeNum)}
          className={`flex-1 h-9 rounded-xl text-xs font-extrabold uppercase tracking-[0.14em] tap-transparent transition-colors ${
            valid && !busy
              ? 'border border-gold/40 bg-gold/15 text-gold hover:bg-gold/25'
              : 'border border-white/5 bg-white/[0.02] text-muted-2 cursor-not-allowed'
          }`}
        >
          {t('bets.confirm')}
        </button>
      </div>
    </div>
  );
}
