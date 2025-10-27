#!/usr/bin/env node
/*
 Local triage tool
 - Reads open issues/PRs
 - Sends to Alex API for recommendations
 - Applies labels/milestones
*/
import 'dotenv/config';
import { Octokit } from '@octokit/rest';

const ALEX_API_URL = process.env.ALEX_API_URL || '';
const ALEX_API_KEY = process.env.ALEX_API_KEY || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const OWNER = process.env.GITHUB_REPOSITORY?.split('/')?.[0] || 'familiarcat';
const REPO = process.env.GITHUB_REPOSITORY?.split('/')?.[1] || 'temporal-wake';

async function fetchAlex(body: any) {
  if (!ALEX_API_URL || !ALEX_API_KEY) {
    console.log('[dry-run] Missing ALEX_API_URL or ALEX_API_KEY');
    return { labels: [], milestone: null, dryRun: true };
  }
  const res = await fetch(ALEX_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ALEX_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Alex API ${res.status}`);
  return await res.json();
}

async function ensureMilestone(octokit: Octokit, title: string) {
  const list = await octokit.issues.listMilestones({ owner: OWNER, repo: REPO, state: 'open' });
  let ms = list.data.find(m => m.title === title);
  if (!ms) {
    const created = await octokit.issues.createMilestone({ owner: OWNER, repo: REPO, title });
    ms = created.data;
  }
  return ms.number;
}

async function triageItem(octokit: Octokit, num: number, isPR: boolean) {
  const item = isPR
    ? (await octokit.pulls.get({ owner: OWNER, repo: REPO, pull_number: num })).data
    : (await octokit.issues.get({ owner: OWNER, repo: REPO, issue_number: num })).data;

  const payload = {
    eventName: 'manual_triage',
    repo: { owner: OWNER, repo: REPO },
    issue: isPR ? undefined : {
      number: item.number,
      title: item.title,
      body: item.body || '',
      labels: (item.labels || []).map((l: any) => typeof l === 'string' ? l : l.name),
      state: item.state,
      isPullRequest: false,
    },
    pull_request: isPR ? {
      number: item.number,
      title: item.title,
      body: item.body || '',
      labels: (item.labels || []).map((l: any) => typeof l === 'string' ? l : l.name),
      state: item.state,
      draft: item.draft || false,
    } : undefined,
  };

  const alex = await fetchAlex(payload);
  if (alex.labels?.length) {
    await octokit.issues.addLabels({ owner: OWNER, repo: REPO, issue_number: num, labels: alex.labels });
  }
  if (alex.milestone && typeof alex.milestone === 'string') {
    const msNum = await ensureMilestone(octokit, alex.milestone);
    await octokit.issues.update({ owner: OWNER, repo: REPO, issue_number: num, milestone: msNum });
  }
}

async function main() {
  const octokit = new Octokit({ auth: GITHUB_TOKEN || undefined });

  const arg = process.argv[2];
  if (arg && /^\d+$/.test(arg)) {
    const num = parseInt(arg, 10);
    const pr = await octokit.pulls.get({ owner: OWNER, repo: REPO, pull_number: num }).catch(() => null);
    await triageItem(octokit, num, !!pr);
    console.log(`Triaged #${num}`);
    return;
  }

  // All open issues
  const issues = await octokit.paginate(octokit.issues.listForRepo, { owner: OWNER, repo: REPO, state: 'open' });
  for (const it of issues) {
    const isPR = !!(it.pull_request);
    await triageItem(octokit, it.number, isPR);
    console.log(`Triaged #${it.number}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

