/**
 * AI Agent Handbook — Cloudflare Worker API
 *
 * Endpoints:
 *   GET  /stats      → { likes: number, feedback_count: number }
 *   POST /like       → { likes: number }
 *   POST /unlike     → { likes: number }
 *   POST /feedback   → { ok: true }
 *   GET  /feedback   → [ ...feedback items ] (protected by ADMIN_KEY)
 *
 * KV Bindings required (add in Cloudflare dashboard):
 *   HANDBOOK_KV  — stores likes count + feedback
 *
 * Environment variables (add in Cloudflare dashboard):
 *   ADMIN_KEY    — a secret string to protect the feedback read endpoint
 *   ALLOWED_ORIGIN — your handbook URL e.g. https://ai-agent-handbook.pages.dev
 */

const LIKES_KEY    = 'likes_count';
const FEEDBACK_KEY = 'feedback_list';

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const method = request.method;
    const origin = request.headers.get('Origin') || '';

    // ── CORS ──────────────────────────────────────────────────────
    const allowed = env.ALLOWED_ORIGIN || 'https://ai-agent-handbook.pages.dev';
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin.includes('pages.dev') || origin.includes('localhost') ? origin : allowed,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
      'Content-Type': 'application/json',
    };

    // Handle preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const respond = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: corsHeaders });

    try {
      // ── GET /stats ──────────────────────────────────────────────
      if (url.pathname === '/stats' && method === 'GET') {
        const likes         = parseInt(await env.HANDBOOK_KV.get(LIKES_KEY) || '0');
        const feedbackRaw   = await env.HANDBOOK_KV.get(FEEDBACK_KEY);
        const feedbackList  = feedbackRaw ? JSON.parse(feedbackRaw) : [];
        return respond({ likes, feedback_count: feedbackList.length });
      }

      // ── POST /like ──────────────────────────────────────────────
      if (url.pathname === '/like' && method === 'POST') {
        const current = parseInt(await env.HANDBOOK_KV.get(LIKES_KEY) || '0');
        const updated = current + 1;
        await env.HANDBOOK_KV.put(LIKES_KEY, String(updated));
        return respond({ likes: updated });
      }

      // ── POST /unlike ────────────────────────────────────────────
      if (url.pathname === '/unlike' && method === 'POST') {
        const current = parseInt(await env.HANDBOOK_KV.get(LIKES_KEY) || '0');
        const updated = Math.max(0, current - 1);
        await env.HANDBOOK_KV.put(LIKES_KEY, String(updated));
        return respond({ likes: updated });
      }

      // ── POST /feedback ──────────────────────────────────────────
      if (url.pathname === '/feedback' && method === 'POST') {
        const body = await request.json();

        // Basic validation
        if (!body.message || body.message.trim().length < 3) {
          return respond({ error: 'Message too short' }, 400);
        }

        // Sanitise
        const entry = {
          id:         crypto.randomUUID(),
          message:    body.message.trim().substring(0, 1000),
          name:       (body.name || 'Anonymous').trim().substring(0, 60),
          section:    body.section || 'unknown',
          time_on_page_sec: body.time_on_page_sec || 0,
          ts:         new Date().toISOString(),
          url:        body.url || '',
        };

        const raw          = await env.HANDBOOK_KV.get(FEEDBACK_KEY);
        const feedbackList = raw ? JSON.parse(raw) : [];
        feedbackList.unshift(entry); // newest first

        // Keep max 500 entries
        if (feedbackList.length > 500) feedbackList.length = 500;
        await env.HANDBOOK_KV.put(FEEDBACK_KEY, JSON.stringify(feedbackList));

        return respond({ ok: true });
      }

      // ── GET /feedback (admin only) ───────────────────────────────
      if (url.pathname === '/feedback' && method === 'GET') {
        const adminKey = request.headers.get('X-Admin-Key') || url.searchParams.get('key');
        if (!env.ADMIN_KEY || adminKey !== env.ADMIN_KEY) {
          return respond({ error: 'Unauthorized' }, 401);
        }
        const raw          = await env.HANDBOOK_KV.get(FEEDBACK_KEY);
        const feedbackList = raw ? JSON.parse(raw) : [];
        return respond({ count: feedbackList.length, items: feedbackList });
      }

      // ── 404 ─────────────────────────────────────────────────────
      return respond({ error: 'Not found' }, 404);

    } catch (err) {
      return respond({ error: 'Internal error', detail: err.message }, 500);
    }
  }
};
