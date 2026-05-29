import type { Context } from 'hono';
import type { AdminAction, Role } from '@prisma/client';
import { prisma } from './db';

interface LogParams {
  actor: string;
  actorRole: Role;
  action: AdminAction;
  target?: string | null;
  payload?: Record<string, unknown> | null;
}

const ACTION_EMOJI: Record<AdminAction, string> = {
  SET_ROLE: '👑',
  BAN_USER: '🔨',
  UNBAN_USER: '🕊️',
  EDIT_STATS: '✏️',
  EDIT_TITLE: '🏷️',
  DELETE_MATCH: '🗑️',
  EDIT_MATCH: '📝',
  REFRESH_IMAGES: '🖼️',
};

function extractIp(c: Context): string | null {
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    null
  );
}

/**
 * Insère une entrée dans admin_audit_log et notifie Discord en fire-and-forget.
 * Toute erreur est avalée — l'audit ne doit jamais empêcher l'action métier.
 */
export async function logAdminAction(c: Context, params: LogParams): Promise<void> {
  const ip = extractIp(c);
  const userAgent = c.req.header('user-agent') ?? null;

  try {
    await prisma.adminAuditLog.create({
      data: {
        actorLogin: params.actor,
        actorRole: params.actorRole,
        action: params.action,
        targetLogin: params.target ?? null,
        payload: params.payload === undefined ? undefined : (params.payload as object),
        ipAddress: ip,
        userAgent,
      },
    });
  } catch (err) {
    console.error('[audit] failed to persist log entry', err);
  }

  void notifyDiscord({ ...params, ip }).catch((err) => {
    console.error('[audit] discord webhook failed', err);
  });
}

async function notifyDiscord(params: LogParams & { ip: string | null }): Promise<void> {
  const url = process.env.DISCORD_AUDIT_WEBHOOK_URL;
  if (!url) return;

  const emoji = ACTION_EMOJI[params.action] ?? '🔔';
  const target = params.target ? ` → \`${params.target}\`` : '';
  const payloadStr =
    params.payload && Object.keys(params.payload).length > 0
      ? '\n```json\n' + JSON.stringify(params.payload, null, 2).slice(0, 1500) + '\n```'
      : '';

  const content =
    `${emoji} **${params.action}** by \`${params.actor}\` (${params.actorRole})${target}` +
    payloadStr;

  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      content,
      allowed_mentions: { parse: [] },
    }),
  });
}
