# Progress Tracker — GitHub Pages Setup

Your progress tracker is now live on GitHub Pages. It auto-updates whenever you push changes to `docs/PROGRESS.md` or `docs/task-dependencies.json`.

## One-time setup

1. **Enable GitHub Pages in your repo:**
   - Go to **Settings** → **Pages** (in your GitHub repo)
   - Under "Source", select **Deploy from a branch**
   - Select branch: **gh-pages**
   - Click **Save**

2. **That's it.** The GitHub Actions workflow will create the `gh-pages` branch on your first push.

## Access your tracker

- **Live URL:** `https://samwyz.github.io/imagine-to-foundry/progress.html`
  (replace `samwyz` with your GitHub username if you forked it)

- **Local development:** Still works via `python -m http.server 8777 --bind 127.0.0.1`

## What happens on push

When you push to `main` and any of these files change:
- `docs/PROGRESS.md`
- `docs/task-dependencies.json`
- `tools/progress.html`

The GitHub Actions workflow (`.github/workflows/deploy-progress.yml`) automatically:
1. Deploys the latest `tools/` directory to the `gh-pages` branch
2. Updates your live tracker

Auto-refresh happens every 30 seconds — the page fetches the latest board and dependencies from your main branch.

## Troubleshooting

**Tracker shows "Could not read the board":**
- Ensure `docs/PROGRESS.md` and `docs/task-dependencies.json` are committed and pushed
- GitHub Pages can take 30–60 seconds to update after the workflow runs
- Check the **Actions** tab in your repo to see if the deploy workflow succeeded

**Local development not working:**
- Make sure you're running `python -m http.server` from the project root
- Visit `http://127.0.0.1:8777/tools/progress.html`
