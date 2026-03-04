# PawTrack — Deployment Guide

## Overview

| Service | Purpose | Cost |
|---|---|---|
| Supabase | Auth + Database | Free |
| Cloudflare Pages | Hosting + CDN | Free forever |
| GitHub | Code repository | Free |

---

## Step 1 — Supabase Setup

1. Go to **https://supabase.com** and create a free account.
2. Click **New project**. Give it a name (e.g. `pawtrack`), choose a region close to your users, and set a database password.
3. Wait ~2 minutes for the project to be ready.

### Run the database setup

4. In Supabase, go to **SQL Editor** (left sidebar).
5. Click **New query**.
6. Copy the entire contents of `setup.sql` and paste it in.
7. Click **Run** (or press Ctrl+Enter). You should see "Success. No rows returned."

### Get your API keys

8. Go to **Project Settings → API** (gear icon in sidebar).
9. Copy:
   - **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
   - **anon public key** — long JWT string under "Project API keys"

### Configure the app

10. Open `config.js` in your editor.
11. Replace the placeholders:

```js
const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

---

## Step 2 — Enable Email Auth

1. In Supabase: **Authentication → Providers → Email**
2. Make sure **"Enable Email provider"** is turned on.
3. For easy testing, turn **"Confirm email"** OFF (can re-enable later).

---

## Step 3 — Push to GitHub

1. Go to **https://github.com** and create a new **empty** repository (no README).
2. In your project folder, open a terminal and run:

```bash
git init
git add .
git commit -m "Initial PawTrack build"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

## Step 4 — Deploy on Cloudflare Pages

1. Go to **https://pages.cloudflare.com** (sign up free if needed).
2. Click **Create a project → Connect to Git**.
3. Connect your GitHub account and select your repository.
4. Configure the build:
   - **Framework preset**: None
   - **Build command**: *(leave empty)*
   - **Build output directory**: `/` (or leave as default)
5. Click **Save and Deploy**.

Cloudflare will deploy your site in ~30 seconds. You'll get a URL like `https://pawtrack.pages.dev`.

### Custom domain (optional)

In Cloudflare Pages → your project → **Custom domains** → add your domain.

---

## Step 5 — Update Supabase Auth Redirect

1. Go to Supabase → **Authentication → URL Configuration**
2. Add your Cloudflare Pages URL to **Site URL**: `https://pawtrack.pages.dev`
3. Also add it to **Redirect URLs**: `https://pawtrack.pages.dev/*`

---

## Done! 🎉

Your app is live at your Cloudflare Pages URL. Every time you push to GitHub, Cloudflare automatically redeploys within ~30 seconds.

---

## File Structure Reference

```
/
├── index.html       ← Landing page + login/signup
├── landing.css      ← Landing page styles
├── app.html         ← Main app (protected)
├── app.css          ← App styles
├── app.js           ← App logic (GPS, walks, dogs, etc.)
├── auth.js          ← Login/register logic
├── breeds.js        ← 110+ breed database + feeding calculator
├── config.js        ← Supabase config (fill in your keys!)
└── setup.sql        ← Run once in Supabase SQL Editor
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Login fails silently | Check Supabase URL and anon key in `config.js` |
| "relation does not exist" error | Run `setup.sql` in Supabase SQL Editor |
| GPS not working | Must be on HTTPS (Cloudflare provides this) or localhost |
| Walks not saving | Check RLS policies ran correctly, confirm user is logged in |
| App stuck on loading | Open browser console (F12) and check for errors |
