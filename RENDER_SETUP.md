Deploy backend to Render

What I added:
- `render.yaml` (basic service config pointing to the `BACK-END` folder)

Steps for you to connect Render (I will test after you finish and tell me):

1. On Render (https://dashboard.render.com) click "New" → "Web Service".
2. Connect your GitHub account and select the repository `COZINHA-ZIMBAO-ONLINE` (branch `main`).
3. If Render detects `render.yaml`, it will use that. If not, create the Web Service manually and set:
   - Root directory: `APLICATIVO-COMIDAS-OROZIMBO/OROZIMBO-SOSTENA/OROZIMBO-SOSTENA/BACK-END`
   - Build command: `npm install`
   - Start command: `node server.js`
4. Add Environment Variables in Render (in the service Settings → Environment):
   - `DATABASE_URL` = your full Postgres connection string (DO NOT commit this to GitHub)
   - `JWT_SECRET` = same secret used locally
   - `JWT_EXPIRATION` = `8h`
   - `NODE_ENV` = `production`

Notes:
- Do not set a static `PORT` — Render provides `$PORT` automatically; server reads `process.env.PORT`.
- Keep `.env` local and never commit it. Use Render's secret env vars.

When you're ready, connect the repo to Render and start the deploy. As soon as you authorize Render to access GitHub and the deploy begins, tell me and I'll monitor logs and run smoke tests against the deployed URL.
