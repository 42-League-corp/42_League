import { useState, useCallback, useRef } from 'react';
import { UploadCloud } from 'lucide-react';
import { type ShopCategory, type ShopItemData, type ShopItemInput } from '../../lib/api';
import { BADGE_ICON_NAMES, badgeIcon } from '../../lib/badgeIcons';

// ─────────────────────────────────────────────────────────────────────────────
// CosmeticForm — formulaire de création/édition de cosmétique, EXTRAIT de
// ShopGODPage pour être réutilisé tel quel par la récompense de tournoi officiel
// (cosmétique custom créé inline). Mêmes champs, même aperçu, mêmes validations.
// ─────────────────────────────────────────────────────────────────────────────

// Dimensions EXACTES exigées pour une bannière (fond de la carte profil). Une image
// déposée qui ne fait pas pile cette taille est REFUSÉE (aucun recadrage).
export const BANNER_W = 1024;
export const BANNER_H = 512;
// Cap d'octets côté client (le serveur revérifie) — évite les data-URL énormes.
export const BANNER_MAX_BYTES = 700_000;

export const CATEGORIES: ShopCategory[] = ['title', 'badge', 'banner'];

export const CATEGORY_LABEL: Record<ShopCategory, string> = {
  title: 'TITRE',
  badge: 'BADGE',
  banner: 'BANNIÈRE',
};

// ── Primitives partagées (langage visuel GODPage) ───────────────────────────

export function Input({
  value,
  onChange,
  placeholder,
  className = '',
  type = 'text',
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 ${className}`}
    />
  );
}

// Petit toggle réutilisable (style GODPage SudoBar).
export function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2 text-xs font-mono cursor-pointer select-none"
    >
      <span className={`relative w-9 h-5 rounded-full transition-colors ${on ? 'bg-emerald-500/70' : 'bg-zinc-700'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {label && <span className={on ? 'text-emerald-400' : 'text-zinc-500'}>{label}</span>}
    </button>
  );
}

// ── État du formulaire (guidé, par catégorie — plus de JSON brut) ────────────

export interface FormState {
  name: string;
  description: string;
  category: ShopCategory;
  color: string; // hex #rrggbb (titres & badges)
  price: string;
  active: boolean;
  sortOrder: string;
  titleText: string; // catégorie title
  badgeCode: string; // catégorie badge
  badgeLabel: string; // catégorie badge
  badgeIconName: string; // catégorie badge (nom lucide)
  bannerImage: string; // catégorie banner (data-URL)
}

export function emptyForm(): FormState {
  return {
    name: '',
    description: '',
    category: 'title',
    color: '#ffc94a',
    price: '0',
    active: true,
    sortOrder: '0',
    titleText: '',
    badgeCode: '',
    badgeLabel: '',
    badgeIconName: 'Crown',
    bannerImage: '',
  };
}

function asRecord(p: ShopItemData['payload']): Record<string, unknown> {
  return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
}

export function formFromItem(it: ShopItemData): FormState {
  const p = asRecord(it.payload);
  return {
    name: it.name,
    description: it.description ?? '',
    category: it.category,
    color: it.color ?? '#ffc94a',
    price: String(it.price),
    active: it.active,
    sortOrder: String(it.sortOrder),
    titleText: typeof p.title === 'string' ? p.title : '',
    badgeCode: typeof p.code === 'string' ? p.code : '',
    badgeLabel: typeof p.label === 'string' ? p.label : '',
    badgeIconName: typeof p.icon === 'string' ? p.icon : 'Crown',
    bannerImage: typeof p.image === 'string' ? p.image : '',
  };
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'badge';
}

/** Construit un ShopItemInput depuis le formulaire guidé (lève une Error explicite). */
export function buildInput(f: FormState): ShopItemInput {
  const name = f.name.trim();
  if (!name) throw new Error('Le nom est obligatoire.');
  let payload: Record<string, unknown> | undefined;
  let color: string | null = null;

  switch (f.category) {
    case 'title': {
      if (!f.titleText.trim()) throw new Error('Le texte du titre est obligatoire.');
      payload = { title: f.titleText.trim() };
      color = f.color || null;
      break;
    }
    case 'badge': {
      if (!f.badgeLabel.trim()) throw new Error('Le label du badge est obligatoire.');
      payload = {
        code: f.badgeCode.trim() || slugify(f.badgeLabel),
        label: f.badgeLabel.trim(),
        icon: f.badgeIconName || 'Award',
      };
      color = f.color || null;
      break;
    }
    case 'banner': {
      if (!f.bannerImage) throw new Error('Dépose une image de bannière à la bonne taille.');
      payload = { image: f.bannerImage };
      break;
    }
  }

  return {
    name,
    description: f.description.trim() || undefined,
    category: f.category,
    color,
    price: Number(f.price) || 0,
    active: f.active,
    sortOrder: Number(f.sortOrder) || 0,
    payload,
  };
}

// ── Dropzone bannière (taille EXACTE obligatoire) ────────────────────────────

export function BannerDropzone({ value, onChange }: { value: string; onChange: (dataUrl: string) => void }) {
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError('');
      if (!file.type.startsWith('image/')) {
        setError('Fichier non-image refusé.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        if (dataUrl.length > BANNER_MAX_BYTES) {
          setError(`Image trop lourde (max ~${Math.round(BANNER_MAX_BYTES / 1000)} Ko).`);
          return;
        }
        const img = new Image();
        img.onload = () => {
          if (img.naturalWidth !== BANNER_W || img.naturalHeight !== BANNER_H) {
            setError(
              `Image refusée : doit faire exactement ${BANNER_W}×${BANNER_H}px (reçu ${img.naturalWidth}×${img.naturalHeight}).`,
            );
            return;
          }
          onChange(dataUrl);
        };
        img.onerror = () => setError('Image illisible.');
        img.src = dataUrl;
      };
      reader.onerror = () => setError('Lecture du fichier impossible.');
      reader.readAsDataURL(file);
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition-colors ${
          dragging ? 'border-violet-400 bg-violet-400/10' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/40'
        }`}
      >
        <UploadCloud className="w-6 h-6 text-zinc-400" />
        <span className="text-xs text-zinc-400 font-mono text-center">
          Glisse une image <span className="text-zinc-200">{BANNER_W}×{BANNER_H}px</span> ou clique pour choisir
        </span>
        <span className="text-[10px] text-zinc-600 font-mono">Taille exacte obligatoire — sinon refusée.</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>
      {error && <div className="text-xs text-red-400 font-mono">{error}</div>}
      {value && <div className="text-[10px] text-emerald-400 font-mono">✓ Image valide ({BANNER_W}×{BANNER_H}).</div>}
    </div>
  );
}

// ── Aperçu live de l'objet en cours d'édition ────────────────────────────────

export function ItemPreview({ form }: { form: FormState }) {
  const Icon = badgeIcon(form.badgeIconName);
  const color = form.color || '#ffc94a';
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 flex flex-col items-center justify-center gap-2 min-h-[120px]">
      <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest self-start">Aperçu</span>
      {form.category === 'title' && (
        <span className="inline-flex items-center gap-1.5">
          <span style={{ color }} className="opacity-70 text-base leading-none">❝</span>
          <span style={{ color }} className="italic text-base font-bold tracking-wide">
            {form.titleText || 'Titre…'}
          </span>
          <span style={{ color }} className="opacity-70 text-base leading-none">❞</span>
        </span>
      )}
      {form.category === 'badge' && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border"
          style={{
            color,
            borderColor: `${color}55`,
            background: `linear-gradient(110deg, ${color}14 0%, ${color}33 45%, ${color}14 70%)`,
          }}
        >
          <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
          {form.badgeLabel || 'Badge…'}
        </span>
      )}
      {form.category === 'banner' &&
        (form.bannerImage ? (
          <div
            className="w-full rounded-lg border border-zinc-700"
            style={{
              aspectRatio: `${BANNER_W} / ${BANNER_H}`,
              backgroundImage: `url(${form.bannerImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        ) : (
          <span className="text-xs text-zinc-600 font-mono">Dépose une image pour l'aperçu.</span>
        ))}
    </div>
  );
}

// Champs partagés du formulaire (création & édition) — guidés par catégorie.
export function ItemFormFields({ form, set }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  const showColor = form.category === 'title' || form.category === 'badge';
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Nom *</span>
          <Input value={form.name} onChange={(v) => set('name', v)} placeholder="ex. Pionnier" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Catégorie</span>
          <select
            value={form.category}
            onChange={(e) => set('category', e.target.value as ShopCategory)}
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm font-mono text-zinc-100 focus:outline-none focus:border-zinc-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </select>
        </label>

        {/* Champs spécifiques à la catégorie */}
        {form.category === 'title' && (
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Texte du titre *</span>
            <Input value={form.titleText} onChange={(v) => set('titleText', v)} placeholder="ex. sans éclat." />
          </label>
        )}
        {form.category === 'badge' && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Label du badge *</span>
              <Input value={form.badgeLabel} onChange={(v) => set('badgeLabel', v)} placeholder="ex. Légende" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Icône</span>
              <select
                value={form.badgeIconName}
                onChange={(e) => set('badgeIconName', e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm font-mono text-zinc-100 focus:outline-none focus:border-zinc-500"
              >
                {BADGE_ICON_NAMES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Code (optionnel — auto depuis le label)</span>
              <Input value={form.badgeCode} onChange={(v) => set('badgeCode', v)} placeholder="ex. legend" />
            </label>
          </>
        )}
        {form.category === 'banner' && (
          <div className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Image de bannière *</span>
            <BannerDropzone value={form.bannerImage} onChange={(v) => set('bannerImage', v)} />
          </div>
        )}

        {showColor && (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Couleur</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color}
                onChange={(e) => set('color', e.target.value)}
                className="w-9 h-9 rounded bg-zinc-800 border border-zinc-700 cursor-pointer"
              />
              <Input value={form.color} onChange={(v) => set('color', v)} placeholder="#ffc94a" className="w-28" />
            </div>
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Prix (League Coins)</span>
          <Input type="number" value={form.price} onChange={(v) => set('price', v)} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Description</span>
          <Input value={form.description} onChange={(v) => set('description', v)} placeholder="Optionnelle" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Ordre d'affichage</span>
          <Input type="number" value={form.sortOrder} onChange={(v) => set('sortOrder', v)} />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Actif</span>
          <div className="h-[34px] flex items-center">
            <Toggle on={form.active} onToggle={() => set('active', !form.active)} label={form.active ? 'Visible' : 'Masqué'} />
          </div>
        </div>
      </div>

      <div className="lg:col-span-1">
        <ItemPreview form={form} />
      </div>
    </div>
  );
}
