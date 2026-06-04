import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Store, Coins, Plus, Pencil, Trash2, Save, X, Gift, UploadCloud } from 'lucide-react';
import {
  api,
  type ShopCategory,
  type ShopItemData,
  type ShopItemInput,
} from '../lib/api';
import { BADGE_ICON_NAMES, badgeIcon } from '../lib/badgeIcons';

type Role = 'ADMIN' | 'SUPERADMIN';

// Dimensions EXACTES exigées pour une bannière (fond de la carte profil). Une image
// déposée qui ne fait pas pile cette taille est REFUSÉE (aucun recadrage).
const BANNER_W = 1024;
const BANNER_H = 512;
// Cap d'octets côté client (le serveur revérifie) — évite les data-URL énormes.
const BANNER_MAX_BYTES = 700_000;

// ── Shared primitives (mirrors GODPage.tsx visual language) ─────────────────

function Btn({
  onClick,
  variant = 'default',
  disabled,
  children,
  className = '',
  type = 'button',
}: {
  onClick?: () => void;
  variant?: 'default' | 'danger' | 'success' | 'warn' | 'ghost';
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  type?: 'button' | 'submit';
}) {
  const base = 'px-2 py-1 text-xs rounded font-mono transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-1';
  const variants = {
    default: 'bg-zinc-700 hover:bg-zinc-600 text-zinc-100',
    danger: 'bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/30',
    success: 'bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 border border-emerald-500/30',
    warn: 'bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400 border border-yellow-500/30',
    ghost: 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

function Input({
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2 px-1">{title}</div>
      {children}
    </div>
  );
}

// Petit toggle réutilisable (style GODPage SudoBar).
function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label?: string }) {
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

const CATEGORIES: ShopCategory[] = ['title', 'badge', 'banner', 'cosmetic'];

const CATEGORY_BADGE: Record<ShopCategory, string> = {
  title: 'bg-amber-400/15 text-amber-400',
  badge: 'bg-fuchsia-400/15 text-fuchsia-400',
  banner: 'bg-violet-400/15 text-violet-400',
  cosmetic: 'bg-sky-400/15 text-sky-400',
};

const CATEGORY_LABEL: Record<ShopCategory, string> = {
  title: 'TITRE',
  badge: 'BADGE',
  banner: 'BANNIÈRE',
  cosmetic: 'COSMÉTIQUE',
};

function CategoryBadge({ category }: { category: ShopCategory }) {
  return (
    <span className={`px-1.5 py-0.5 text-xs rounded font-mono tracking-wide ${CATEGORY_BADGE[category]}`}>
      {CATEGORY_LABEL[category]}
    </span>
  );
}

function CoinIcon() {
  return <img src="/42coin.png" alt="League Coin" className="w-4 h-4 inline-block align-text-bottom" />;
}

// ── Form state (guidé, par catégorie — plus de JSON brut) ────────────────────

interface FormState {
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

function emptyForm(): FormState {
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

function formFromItem(it: ShopItemData): FormState {
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
function buildInput(f: FormState): ShopItemInput {
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
    case 'cosmetic':
      payload = undefined;
      break;
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

function BannerDropzone({ value, onChange }: { value: string; onChange: (dataUrl: string) => void }) {
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

function ItemPreview({ form }: { form: FormState }) {
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
      {form.category === 'cosmetic' && (
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold bg-sky-400/15 text-sky-300 border border-sky-400/30">
          {form.name || 'Cosmétique…'}
        </span>
      )}
    </div>
  );
}

// Champs partagés du formulaire (création & édition) — guidés par catégorie.
function ItemFormFields({ form, set }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
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

// ── Modal d'édition d'un item ───────────────────────────────────────────────

function EditItemModal({
  item,
  onClose,
  onSaved,
}: {
  item: ShopItemData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => formFromItem(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }));
  }, []);

  async function handleSave() {
    setError('');
    let input: ShopItemInput;
    try {
      input = buildInput(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      return;
    }
    setSaving(true);
    try {
      await api.adminUpdateShopItem(item.id, input);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-[48rem] max-w-full max-h-[88vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-mono text-zinc-300">
            Modifier — <span className="text-zinc-100 font-bold">{item.name}</span>
          </div>
          <Btn variant="ghost" onClick={onClose}><X className="w-3.5 h-3.5" /></Btn>
        </div>
        <ItemFormFields form={form} set={set} />
        {error && <div className="mt-3 text-xs text-red-400 font-mono">{error}</div>}
        <div className="mt-5 flex gap-2 justify-end">
          <Btn onClick={onClose} variant="ghost">Annuler</Btn>
          <Btn onClick={handleSave} disabled={saving} variant="success">
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── Section 1 : gestion des items ───────────────────────────────────────────

function ItemsSection({ onItemsChanged }: { onItemsChanged?: (items: ShopItemData[]) => void }) {
  const [items, setItems] = useState<ShopItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ShopItemData | null>(null);

  // Formulaire de création.
  const [createForm, setCreateForm] = useState<FormState>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createOk, setCreateOk] = useState('');

  const setCreate = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
    setCreateForm((prev) => ({ ...prev, [k]: v }));
  }, []);

  const load = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true);
      api.adminShopItems()
        .then((list) => {
          const sorted = [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
          setItems(sorted);
          onItemsChanged?.(sorted);
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
        .finally(() => setLoading(false));
    },
    [onItemsChanged],
  );

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    setCreateError('');
    setCreateOk('');
    let input: ShopItemInput;
    try {
      input = buildInput(createForm);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Erreur');
      return;
    }
    setCreating(true);
    try {
      const created = await api.adminCreateShopItem(input);
      setCreateOk(`Cosmétique « ${created.name} » créé.`);
      setCreateForm(emptyForm());
      load(true);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(it: ShopItemData) {
    setPendingId(it.id);
    setError('');
    try {
      await api.adminUpdateShopItem(it.id, { active: !it.active });
      load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(it: ShopItemData) {
    if (!confirm(`Supprimer définitivement « ${it.name} » ? Cette action est irréversible.`)) return;
    setPendingId(it.id);
    setError('');
    try {
      await api.adminDeleteShopItem(it.id);
      load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="p-4">
      {editing && (
        <EditItemModal item={editing} onClose={() => setEditing(null)} onSaved={() => load(true)} />
      )}

      {/* Formulaire de création */}
      <Section title="Créer un cosmétique">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <ItemFormFields form={createForm} set={setCreate} />
          {createError && <div className="mt-3 text-xs text-red-400 font-mono">{createError}</div>}
          {createOk && <div className="mt-3 text-xs text-emerald-400 font-mono">{createOk}</div>}
          <div className="mt-4 flex justify-end">
            <Btn onClick={handleCreate} disabled={creating} variant="success" className="px-3 py-1.5">
              <Plus className="w-3.5 h-3.5" />
              {creating ? 'Création…' : 'Créer un cosmétique'}
            </Btn>
          </div>
        </div>
      </Section>

      {/* Liste des items */}
      <Section title="Items de la boutique">
        <div className="mb-3 flex items-center gap-3">
          <Btn onClick={() => load()} variant="ghost">↻ Recharger</Btn>
          <span className="text-zinc-600 text-xs font-mono">{items.length} item{items.length !== 1 ? 's' : ''}</span>
        </div>
        {error && <div className="mb-3 text-xs text-red-400 font-mono">{error}</div>}
        {loading ? (
          <div className="text-zinc-500 text-sm font-mono">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="text-zinc-600 text-sm font-mono">Aucun item — créez-en un ci-dessus.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="text-left py-2 px-3">Nom</th>
                  <th className="text-left py-2 px-3">Catégorie</th>
                  <th className="text-right py-2 px-3">Prix</th>
                  <th className="text-right py-2 px-3">Ordre</th>
                  <th className="text-center py-2 px-3">Actif</th>
                  <th className="text-right py-2 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr
                    key={it.id}
                    className={`border-b border-zinc-800/40 hover:bg-zinc-900/60 transition-colors ${it.active ? '' : 'opacity-45'}`}
                  >
                    <td className="py-2 px-3 text-zinc-100">
                      <span className="inline-flex items-center gap-2">
                        {it.color && (
                          <span className="w-3 h-3 rounded-full border border-zinc-600" style={{ background: it.color }} />
                        )}
                        {it.name}
                      </span>
                      {it.description && (
                        <span className="block text-[10px] text-zinc-500 max-w-xs truncate" title={it.description}>{it.description}</span>
                      )}
                    </td>
                    <td className="py-2 px-3"><CategoryBadge category={it.category} /></td>
                    <td className="py-2 px-3 text-right tabular-nums text-amber-400">
                      <span className="inline-flex items-center gap-1 justify-end">
                        {it.price} <CoinIcon />
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{it.sortOrder}</td>
                    <td className="py-2 px-3">
                      <div className="flex justify-center">
                        <Toggle on={it.active} onToggle={() => toggleActive(it)} />
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <Btn onClick={() => setEditing(it)} variant="default" disabled={pendingId === it.id}>
                          <Pencil className="w-3.5 h-3.5" /> Éditer
                        </Btn>
                        <Btn onClick={() => handleDelete(it)} variant="danger" disabled={pendingId === it.id} className="border border-red-500/40">
                          <Trash2 className="w-3.5 h-3.5" /> Suppr
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Section 2 : créditer des League Coins ───────────────────────────────────

function GrantCoinsSection() {
  const [login, setLogin] = useState('');
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleGrant() {
    const l = login.trim();
    const amt = Number(amount);
    setError('');
    setSuccess('');
    if (!l) {
      setError('Le login du joueur est obligatoire.');
      return;
    }
    if (!Number.isFinite(amt) || amt === 0) {
      setError('Le montant doit être un nombre non nul (négatif pour retirer).');
      return;
    }
    setPending(true);
    try {
      const res = await api.adminGrantCoins(l, amt);
      setSuccess(`@${res.login} a désormais ${res.coins} League Coin${res.coins !== 1 ? 's' : ''}.`);
      setAmount('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur (login inconnu ?)');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="p-4">
      <Section title="Créditer des League Coins">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Login du joueur</span>
            <Input value={login} onChange={setLogin} placeholder="ex. throbert" className="w-48" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Montant (négatif = retrait)</span>
            <Input type="number" value={amount} onChange={setAmount} placeholder="ex. 100" className="w-40" />
          </div>
          <Btn onClick={handleGrant} disabled={pending} variant="success" className="px-3 py-1.5">
            <Coins className="w-3.5 h-3.5" />
            {pending ? 'En cours…' : 'Créditer'}
          </Btn>
          <span className="text-[10px] text-zinc-600 font-mono w-full">
            Utilisez un montant négatif pour retirer des League Coins à un joueur.
          </span>
          {error && <div className="w-full text-xs text-red-400 font-mono">{error}</div>}
          {success && <div className="w-full text-xs text-emerald-400 font-mono">{success}</div>}
        </div>
      </Section>
    </div>
  );
}

// ── Section 3 : donner un cosmétique à un joueur ─────────────────────────────

function GrantItemSection({ items }: { items: ShopItemData[] }) {
  const [login, setLogin] = useState('');
  const [itemId, setItemId] = useState('');
  const [equip, setEquip] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleGrant() {
    const l = login.trim();
    setError('');
    setSuccess('');
    if (!l) {
      setError('Le login du joueur est obligatoire.');
      return;
    }
    if (!itemId) {
      setError('Choisis un cosmétique à donner.');
      return;
    }
    setPending(true);
    try {
      await api.adminGrantItem(l, itemId, equip);
      const it = items.find((i) => i.id === itemId);
      setSuccess(`« ${it?.name ?? itemId} » donné à @${l}${equip ? ' et équipé' : ''}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur (login/objet inconnu ?)');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="p-4">
      <Section title="Donner un cosmétique à un joueur">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Login du joueur</span>
            <Input value={login} onChange={setLogin} placeholder="ex. throbert" className="w-48" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Cosmétique</span>
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm font-mono text-zinc-100 focus:outline-none focus:border-zinc-500 w-64"
            >
              <option value="">— choisir —</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  [{CATEGORY_LABEL[it.category]}] {it.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Équiper</span>
            <div className="h-[34px] flex items-center">
              <Toggle on={equip} onToggle={() => setEquip(!equip)} label={equip ? 'Auto-équipé' : 'Inventaire seul'} />
            </div>
          </div>
          <Btn onClick={handleGrant} disabled={pending} variant="success" className="px-3 py-1.5">
            <Gift className="w-3.5 h-3.5" />
            {pending ? 'En cours…' : 'Donner'}
          </Btn>
          {error && <div className="w-full text-xs text-red-400 font-mono">{error}</div>}
          {success && <div className="w-full text-xs text-emerald-400 font-mono">{success}</div>}
        </div>
      </Section>
    </div>
  );
}

// ── Page principale (self-guard admin) ──────────────────────────────────────

export function ShopGODPage() {
  const navigate = useNavigate();
  const [myLogin, setMyLogin] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [items, setItems] = useState<ShopItemData[]>([]);

  useEffect(() => {
    api.me()
      .then((data) => {
        const role = data.role;
        if (role === 'ADMIN' || role === 'SUPERADMIN') {
          setMyLogin(data.login);
          setMyRole(role);
        } else {
          setMyRole(null);
        }
      })
      .catch(() => setMyRole(null))
      .finally(() => setAuthLoading(false));
  }, []);

  if (authLoading) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center overflow-hidden">
        <span className="text-zinc-500 font-mono text-sm">Vérification des droits…</span>
      </div>
    );
  }

  if (!myRole || !myLogin) {
    return (
      <div className="h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 overflow-hidden">
        <span className="text-red-400 font-mono text-2xl font-bold">403</span>
        <span className="text-zinc-400 font-mono text-sm">Accès refusé. Admins uniquement.</span>
        <button onClick={() => navigate('/')} className="text-zinc-500 font-mono text-xs hover:text-zinc-300 transition-colors cursor-pointer">
          ← Retour
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 font-mono flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              aria-label="Retour à l'application"
              className="flex items-center justify-center w-8 h-8 -ml-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
            </button>
            <img src="/42coin.png" alt="League Coin" className="w-6 h-6" />
            <div className="flex flex-col leading-tight">
              <span className="text-zinc-200 font-bold tracking-widest text-sm flex items-center gap-1.5">
                <Store className="w-4 h-4 text-amber-400" /> SHOP GOD
              </span>
              <span className="text-[10px] text-zinc-500">Gestion de la boutique — cosmétiques &amp; League Coins</span>
            </div>
            <span className="text-zinc-700">|</span>
            <span className="text-zinc-400 text-xs">{myLogin}</span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-zinc-500 text-xs hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
            Retour app
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto">
          <GrantCoinsSection />
          <GrantItemSection items={items} />
          <ItemsSection onItemsChanged={setItems} />
        </div>
      </div>
    </div>
  );
}

export default ShopGODPage;
