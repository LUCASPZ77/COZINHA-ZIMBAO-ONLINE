Deploy instructions

Overview
- Backend: deploy to Render (Node service)
- Frontend: deploy to Vercel (static site)

Prepare repository
1. Create a GitHub repository and push the project root (APLICATIVO-COMIDAS-OROZIMBO folder) to GitHub.
2. Make sure `.gitignore` (already added) excludes `BACK-END/.env` so secrets are not committed.

Backend (Render)
1. On Render (https://dashboard.render.com), click "New" → "Web Service".
2. Connect your GitHub account and choose the repository and the branch to deploy.
3. Build/Start command:
   - Build command: leave empty (no build) or optionally `npm install`
   - Start command: `npm start` (server uses `server.js`)
4. Set Environment Variables in Render (Settings → Environment):
   - `DATABASE_URL` = your Supabase connection string (postgresql://...)
   - `JWT_SECRET` = same as in `.env`
   - `JWT_EXPIRATION` = `8h` (or your value)
   - `NODE_ENV` = `production`
5. Deploy. Render will build and start the service and provide a public URL.

Frontend (Vercel)
1. On Vercel (https://vercel.com), click "New Project" → Import Git Repository.
2. Choose your repository and the frontend folder (if using root static site, Vercel will detect `index.html`).
3. Build settings: none needed for static HTML; set Output Directory to the folder containing `index.html` (FRONT-END).
4. Environment Variables (if needed):
   - `EXT_PUBLIC_SUPABASE_URL` = https://<your-project>.supabase.co
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = your public key (optional for static usage)
5. Deploy. Vercel will give a public URL.

Post-deploy checklist
- In Render, verify logs and that the service started successfully.
- In Vercel, verify the frontend loads and calls API endpoints.
- In Render, add CORS allowed origin (if you protect CORS) to allow Vercel domain or set CORS to allow frontend origin.

Notes and security
- Do not commit `.env` or secrets. Use Render/Vercel secret environment variables.
- If you want to run everything on Vercel (serverless), I can adapt the backend to use `@supabase/supabase-js` to be serverless-friendly.

If you want, I can generate the exact `git` commands to init the repo and push to GitHub, or I can walk you through connecting Render and Vercel step-by-step.