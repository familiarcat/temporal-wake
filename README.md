# Temporal Wake

## Preview UI
- Next.js app in `preview-ui/`
- Run: `npm install && npm run dev` from `preview-ui`

## Pandoc HTML previews
- From repo root: `./build_md_previews.sh`
- Outputs: `screenplay.html`, `novel.html`, `outline.html`

## Alex AI Integration
### CI
- Workflow: `.github/workflows/alex-triage.yml`
- Requires GitHub Secrets: `ALEX_API_URL`, `ALEX_API_KEY`

### Local CLI
- Script: `scripts/alex-triage.ts`
- Env: `.env.local` with `ALEX_API_URL`, `ALEX_API_KEY` and optionally `GITHUB_TOKEN`
- Usage:
  - `node scripts/alex-triage.ts` (all open issues/PRs)
  - `node scripts/alex-triage.ts 123` (single item)

### Labels & Milestones
- Alex can suggest labels and milestones; the workflow creates missing milestones automatically.
