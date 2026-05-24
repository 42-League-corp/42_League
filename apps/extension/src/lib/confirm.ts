const HOST_ID = 'league-42-confirm-host';
const STYLE_ID = 'league-42-confirm-style';

export interface ConfirmOptions {
  title: string;
  message: string;
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    #${HOST_ID} {
      position: fixed; inset: 0;
      z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(4px);
      animation: l42cf-in 120ms ease-out;
      font-family: 'Inter', system-ui, sans-serif;
    }
    @keyframes l42cf-in { from { opacity: 0 } to { opacity: 1 } }
    @keyframes l42cf-pop { from { transform: scale(0.92); opacity: 0 } to { transform: scale(1); opacity: 1 } }
    #${HOST_ID} .l42cf-card {
      background: #0b0f17;
      color: #e6ecf5;
      border: 1px solid #243044;
      border-radius: 4px;
      padding: 22px 22px 18px;
      width: 380px; max-width: calc(100vw - 32px);
      box-shadow: 0 18px 48px rgba(0,0,0,0.5), 0 0 32px rgba(0, 217, 220, 0.18);
      animation: l42cf-pop 160ms ease-out;
    }
    #${HOST_ID} .l42cf-title {
      font-size: 13px; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.18em;
      color: #00d9dc;
      margin-bottom: 12px;
    }
    #${HOST_ID} .l42cf-msg { font-size: 13px; line-height: 1.5; color: #e6ecf5; }
    #${HOST_ID} .l42cf-warn {
      margin-top: 12px;
      background: rgba(255, 59, 92, 0.08);
      border: 1px solid rgba(255, 59, 92, 0.45);
      color: #ff8095;
      padding: 10px 12px;
      border-radius: 3px;
      font-size: 12px; font-weight: 500;
      line-height: 1.4;
    }
    #${HOST_ID} .l42cf-actions {
      display: flex; gap: 10px; justify-content: flex-end;
      margin-top: 18px;
    }
    #${HOST_ID} button {
      font-family: inherit; font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em;
      padding: 9px 18px; border-radius: 3px; cursor: pointer;
      border: none; transition: filter 120ms, transform 80ms, box-shadow 120ms;
    }
    #${HOST_ID} button.l42cf-cancel {
      background: transparent; color: #95a3b8;
      border: 1px solid #243044;
    }
    #${HOST_ID} button.l42cf-cancel:hover {
      color: #fff; border-color: #6b7689;
    }
    #${HOST_ID} button.l42cf-ok {
      background: linear-gradient(180deg, #00d9dc, #00babc);
      color: #001416;
    }
    #${HOST_ID} button.l42cf-ok:hover { filter: brightness(1.1); box-shadow: 0 0 12px rgba(0, 217, 220, 0.35); }
    #${HOST_ID} button.l42cf-ok.l42cf-danger {
      background: linear-gradient(180deg, #ff3b5c, #c8203f);
      color: #fff;
    }
    #${HOST_ID} button.l42cf-ok.l42cf-danger:hover { box-shadow: 0 0 14px rgba(255, 59, 92, 0.5); }
  `;
  document.head.appendChild(s);
}

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  ensureStyle();
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.id = HOST_ID;
    const card = document.createElement('div');
    card.className = 'l42cf-card';

    const title = document.createElement('div');
    title.className = 'l42cf-title';
    title.textContent = opts.title;
    const msg = document.createElement('div');
    msg.className = 'l42cf-msg';
    msg.textContent = opts.message;
    card.append(title, msg);

    if (opts.warning) {
      const warn = document.createElement('div');
      warn.className = 'l42cf-warn';
      warn.textContent = opts.warning;
      card.append(warn);
    }

    const actions = document.createElement('div');
    actions.className = 'l42cf-actions';
    const cancel = document.createElement('button');
    cancel.className = 'l42cf-cancel';
    cancel.textContent = opts.cancelLabel ?? 'Annuler';
    const ok = document.createElement('button');
    ok.className = 'l42cf-ok' + (opts.danger ? ' l42cf-danger' : '');
    ok.textContent = opts.confirmLabel ?? 'Confirmer';

    const finish = (v: boolean) => {
      document.removeEventListener('keydown', onKey);
      host.remove();
      resolve(v);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false);
      else if (e.key === 'Enter') finish(true);
    };
    cancel.onclick = () => finish(false);
    ok.onclick = () => finish(true);
    host.onclick = (e) => {
      if (e.target === host) finish(false);
    };
    document.addEventListener('keydown', onKey);

    actions.append(cancel, ok);
    card.append(actions);
    host.append(card);
    document.body.append(host);
    setTimeout(() => ok.focus(), 0);
  });
}
