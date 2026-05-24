export const widgetStyles = `
:host {
  all: initial;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

@keyframes league-spin {
  to { transform: rotate(360deg); }
}
@keyframes league-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes league-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 186, 188, 0.4); }
  50%      { box-shadow: 0 0 0 8px rgba(0, 186, 188, 0); }
}
@keyframes league-check {
  0%   { stroke-dashoffset: 30; }
  100% { stroke-dashoffset: 0; }
}
@keyframes league-glow {
  0%, 100% { border-color: #00babc; }
  50%      { border-color: #66e3e4; }
}

.league-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #fff;
  color: #1a1a1a;
  border: 1px solid #e3e3e3;
  border-radius: 6px;
  padding: 14px 16px;
  margin: 16px 0;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  font-size: 13px;
  line-height: 1.4;
  animation: league-fade-in 200ms ease-out;
  transition: border-color 200ms, box-shadow 200ms, background 200ms;
}
/* === connecté : bordure 42, fond très légèrement teinté === */
.league-panel.is-authed {
  border: 1px solid #00babc;
  background: linear-gradient(180deg, #f5fdfd 0%, #ffffff 60%);
  box-shadow: 0 2px 8px rgba(0, 186, 188, 0.12);
}
/* === déconnecté : monochrome, plus discret === */
.league-panel.is-anon {
  border: 1px dashed #c8c8c8;
  background: #fafafa;
  text-align: center;
}

.league-panel header {
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #efefef;
  padding-bottom: 8px;
}
.league-panel.is-anon header { justify-content: center; border-bottom: none; padding-bottom: 0; }

.league-panel h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #00babc;
}
.league-panel .header-meta {
  display: flex; flex-direction: column; gap: 1px;
  margin-left: auto; text-align: right;
}
.league-panel .header-login {
  font-size: 12px; color: #1a1a1a; font-weight: 600;
}
.league-panel .header-elo {
  font-size: 11px; color: #00babc; font-variant-numeric: tabular-nums;
  font-weight: 600; letter-spacing: 0.04em;
}

.league-panel .avatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: #00babc;
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 12px;
  text-transform: uppercase;
}
.league-panel.connecting .avatar,
.league-panel.connecting .ring {
  animation: league-pulse 1.2s infinite;
}
.league-panel.connecting {
  animation: league-glow 1.6s infinite;
  border-style: solid;
  border-color: #00babc;
}

.league-panel button {
  font-family: inherit;
  font-size: 12px;
  background: #00babc;
  color: #fff;
  border: none;
  border-radius: 3px;
  padding: 7px 12px;
  cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  transition: background 120ms, transform 80ms;
}
.league-panel button:hover { background: #00a3a5; }
.league-panel button:active { transform: scale(0.97); }
.league-panel button.ghost {
  background: transparent;
  color: #777;
  border: 1px solid #ddd;
}
.league-panel button.ghost:hover { color: #00babc; border-color: #00babc; background: #f5fdfd; }
.league-panel button:disabled { opacity: 0.55; cursor: default; transform: none; }

.league-panel .row { display: flex; align-items: center; gap: 8px; }

.league-panel .section-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #999;
  margin: 4px 0 2px;
  font-weight: 600;
}
.league-panel ol {
  margin: 0; padding: 0; list-style: none;
  display: flex; flex-direction: column; gap: 2px;
}
.league-panel ol li {
  display: grid;
  grid-template-columns: 24px 1fr auto;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px dashed #f1f1f1;
  animation: league-fade-in 200ms ease-out;
}
.league-panel ol li:last-child { border-bottom: none; }
.league-panel ol li.me {
  background: #f5fdfd;
  border-radius: 3px;
  padding: 4px 6px;
  margin-left: -6px;
  margin-right: -6px;
  border-bottom: 1px solid #d0f0f0;
}
.league-panel .rank { color: #aaa; font-variant-numeric: tabular-nums; }
.league-panel .elo { color: #00babc; font-variant-numeric: tabular-nums; font-weight: 600; }

.league-panel .pending-card {
  display: flex; align-items: center; justify-content: space-between;
  background: #fff8e1; border: 1px solid #f5e0a8;
  border-radius: 4px; padding: 7px 10px;
  animation: league-fade-in 200ms ease-out;
}
.league-panel .pending-card.to-confirm {
  display: flex; flex-direction: column; align-items: stretch; gap: 6px;
}
.league-panel .pending-card.confirmed {
  background: #e6faf5; border-color: #9be5cb;
}
.league-panel .pending-summary {
  display: flex; align-items: center; justify-content: space-between;
  font-weight: 500;
}
.league-panel .confirm-hint { font-size: 11px; }
.league-panel .confirm-grid {
  display: grid; grid-template-columns: 56px 56px 1fr auto; gap: 6px;
  align-items: center;
}
.league-panel button.ghost.danger {
  color: #b00020; border-color: #f0c0c8;
}
.league-panel button.ghost.danger:hover {
  color: #fff; background: #b00020; border-color: #b00020;
}

.league-panel .declare-form { display: grid; gap: 6px; }
.league-panel .declare-form .grid {
  display: grid; grid-template-columns: 1fr 56px 56px auto; gap: 6px;
}
.league-panel input[type="text"], .league-panel input[type="number"] {
  font-family: inherit; font-size: 12px;
  padding: 6px 8px; border: 1px solid #d8d8d8; border-radius: 3px;
  background: #fff; color: #1a1a1a; width: 100%; box-sizing: border-box;
  transition: border-color 120ms;
}
.league-panel input:focus { outline: none; border-color: #00babc; }
.league-panel .empty { color: #999; font-style: italic; font-size: 12px; }
.league-panel .error { color: #b00020; font-size: 12px; }
.league-panel .muted { color: #888; font-size: 11px; }

/* Spinner */
.spinner {
  width: 12px; height: 12px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: league-spin 0.7s linear infinite;
  display: inline-block;
}
.spinner.dark {
  border-color: rgba(0, 186, 188, 0.25);
  border-top-color: #00babc;
}

/* Checkmark */
.check-icon {
  width: 14px; height: 14px;
}
.check-icon path {
  stroke: #1a8a5e;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
  stroke-dasharray: 30;
  stroke-dashoffset: 30;
  animation: league-check 400ms ease-out forwards;
}

.toast {
  position: relative;
  background: #e6faf5;
  border: 1px solid #9be5cb;
  color: #1a6646;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  display: flex; align-items: center; gap: 6px;
  animation: league-fade-in 200ms ease-out;
}

/* Anon big call-to-action */
.anon-cta {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 8px 0;
}
.anon-cta .ring {
  width: 44px; height: 44px;
  border-radius: 50%;
  background: #f5fdfd;
  border: 2px dashed #00babc;
  display: flex; align-items: center; justify-content: center;
  color: #00babc; font-size: 20px; font-weight: 700;
}
.anon-cta p { margin: 0; color: #555; font-size: 12px; }
.anon-cta button { padding: 8px 14px; font-size: 13px; }
`;
