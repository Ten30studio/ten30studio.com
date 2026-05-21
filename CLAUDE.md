# ten30studio.com

The Ten30 Studios website. Static HTML site deployed on Vercel.

## Production

- **Vercel project**: `ten30studio-com`
- **Production branch**: `master` — every push to master auto-deploys to production
- **Domains**: `www.ten30studio.com` + `ten30studio.com` (apex)
- **Stack**: static HTML, no framework. `api/` holds Vercel serverless functions (Stripe checkout, careflow lead capture).

> History: the repo was once connected to multiple Vercel projects; the custom domains were consolidated onto `ten30studio-com` on 2026-05-21. Do not reconnect other Vercel projects to this repo — it caused 45h of stale-content serving.

## Structure

- `index.html` — The Lab home
- `planners.html` — Planners & Tools family
- `ai.html` — AI Tools family (CareFlow · Forge · DevTools Hub)
- `studio.html` — brand story
- `careflow.html` + `careflow-{birmingham,sutton-coldfield,west-midlands}.html` + `careflow/index.html` — UK care-home lead pages
- `css/site.css` — shared design system (one source of truth for tokens, components, grid)
- `vercel.json` — `cleanUrls:true` + careflow rewrites
- `api/checkout.js`, `api/careflow-lead.js` — serverless functions

## Conventions

- The design system lives in `css/site.css`. New pages link it; do not re-declare tokens inline.
- Keep `gtag.js` (Google Ads `AW-18174714356`) on every page.
- careflow pages: structure is deliberate (operator-focused lead capture). Palette/typography may align to the new system; structure must not change.
- Preserve Stripe `/api/checkout` wiring on `ai.html`.
