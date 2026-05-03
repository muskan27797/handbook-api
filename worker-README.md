# AI Agent Handbook — Backend Worker

Cloudflare Worker powering likes and feedback for ai-agent-handbook.pages.dev

## Deploy in 5 steps

### 1. Install Wrangler
```bash
npm install -g wrangler
wrangler login
```

### 2. Create the KV namespace
```bash
wrangler kv:namespace create HANDBOOK_KV
```
Copy the returned `id` and paste it into `wrangler.toml` where it says `PASTE_YOUR_KV_ID_HERE`.

### 3. Set your admin secret
```bash
wrangler secret put ADMIN_KEY
# Enter any long random string — you'll use this to read feedback
# e.g. my-secret-key-1234-handbook
```

### 4. Deploy
```bash
wrangler deploy
```
You'll get a URL like: `https://handbook-api.YOUR_SUBDOMAIN.workers.dev`

### 5. Update the handbook
In `index.html`, find:
```js
const WORKER_URL = 'YOUR_WORKER_URL';
```
Replace with your actual Worker URL:
```js
const WORKER_URL = 'https://handbook-api.YOUR_SUBDOMAIN.workers.dev';
```
Commit and push — done.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Returns `{ likes, feedback_count }` |
| POST | `/like` | Increment like count |
| POST | `/unlike` | Decrement like count |
| POST | `/feedback` | Submit feedback `{ message, name, section }` |
| GET | `/feedback?key=YOUR_ADMIN_KEY` | Read all feedback (admin only) |

## Reading feedback

```bash
curl "https://handbook-api.YOUR_SUBDOMAIN.workers.dev/feedback?key=YOUR_ADMIN_KEY"
```

Or in browser:
```
https://handbook-api.YOUR_SUBDOMAIN.workers.dev/feedback?key=YOUR_ADMIN_KEY
```

---

Free tier limits (more than enough):
- Workers: 100,000 requests/day
- KV: 100,000 reads/day, 1,000 writes/day
- Storage: 1GB
