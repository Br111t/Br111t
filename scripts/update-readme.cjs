// scripts/update-readme.cjs
const fs = require("fs");
const https = require("https");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

/* ---------- Config & helpers ---------- */
const GH_TOKEN = process.env.GITHUB_TOKEN;
const H = { "User-Agent": "br111t-activity", ...(GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {}) };

async function gh(url) {
  const r = await fetch(url, { headers: H });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
  return r.json();
}

function isMyCommit(c) {
  const login = (c.author?.login || "").toLowerCase();
  const name  = (c.commit?.author?.name || "").toLowerCase();
  const email = (c.commit?.author?.email || "").toLowerCase();

  return login === "br111t" ||
         name.includes("brittany") || name.includes("bales") || name.includes("br111t") ||
         email.endsWith("@users.noreply.github.com"); // keeps it permissive for your noreply
}

function isBotCommit(c) {
  const login = (c.author?.login || "").toLowerCase();
  const msg   = (c.commit?.message || "").toLowerCase();
  const email = (c.commit?.author?.email || "").toLowerCase();

  // Known bot patterns (keep it narrow)
  if (login.endsWith("[bot]")) return true;
  if (login === "github-actions[bot]") return true;
  if (msg.includes("dependabot")) return true;
  if (email.startsWith("noreply+dependabot@")) return true;

  // Do NOT block just because committer/author name contains "GitHub"
  return false;
}

async function listOrgRepos(org, pages = 3) {
  const all = [];
  for (let page = 1; page <= pages; page++) {
    const batch = await gh(`https://api.github.com/orgs/${org}/repos?per_page=100&page=${page}&type=all&sort=updated`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

function isWithinDays(dateStrOrDate, days) {
  if (!dateStrOrDate) return false;
  const d = (dateStrOrDate instanceof Date) ? dateStrOrDate : new Date(dateStrOrDate);
  const now = new Date();
  return (now - d) <= days * 24 * 60 * 60 * 1000;
}

async function lastHumanCommitDate(owner, repo, pages = 3) {
  const info = await gh(`https://api.github.com/repos/${owner}/${repo}`);
  const def = info.default_branch || "main";

  for (let page = 1; page <= pages; page++) {
    const list = await gh(`https://api.github.com/repos/${owner}/${repo}/commits?sha=${def}&per_page=100&page=${page}`);
    if (!Array.isArray(list) || list.length === 0) break;

    // 1) Prefer your commit (not a bot)
    let chosen = list.find(c => isMyCommit(c) && !isBotCommit(c));
    // 2) Fallback: any non-bot commit
    if (!chosen) chosen = list.find(c => !isBotCommit(c));
    // 3) Last resort: take the first commit on the branch
    if (!chosen) chosen = list[0];

    if (chosen) {
      const d = new Date(chosen.commit.committer.date);
      console.log(`[activity] ${owner}/${repo} -> ${d.toISOString()} by ${chosen.author?.login || chosen.commit?.author?.name}`);
      return d;               // <-- you were missing this!
    }
  }

  console.log(`[activity] ${owner}/${repo} -> no qualifying commits found on ${def}`);
  return null;
}


function getLanguageEmoji(language) {
  const map = {
    Python: "🐍",
    Java: "☕",
    JavaScript: "🟨",
    TypeScript: "🔷",
    HTML: "🌐",
    CSS: "🎨",
    Shell: "🐚",
    "PowerShell": "🪟",
    Dockerfile: "🐳",
    "Jupyter Notebook": "📓",
    Go: "💙",
    "C++": "➕➕",
    "C#": "🎯",
    C: "📘",
    Rust: "🦀",
    YAML: "📄",
    Makefile: "🧱"
  };
  return map[language] || "";
}

function languageListToTwoLines(languagesObj, primaryFromRepo) {
  // top 5 by bytes
  const entries = Object.entries(languagesObj)
    .sort((a,b) => b[1]-a[1])
    .map(([lang]) => `${getLanguageEmoji(lang)} ${lang}`);

  // fallback to GitHub’s primary language if empty
  if (entries.length === 0 && primaryFromRepo) {
    entries.push(`${getLanguageEmoji(primaryFromRepo)} ${primaryFromRepo}`);
  }

  if (entries.length <= 2) return entries.join(", ") || "⚠️ No code detected";

  const firstLine = entries.slice(0, 2).join(", ");
  const secondLine = entries.slice(2).join(", ");
  return `${firstLine}<br>${secondLine}`;
}

/* ---------- Repos to show ---------- */
const repos = [
  { name: "notebook-to-prod-template",
    ci: "https://github.com/Br111t/notebook-to-prod-template/actions/workflows/ci.yml/badge.svg?branch=main",
    url: "https://github.com/Br111t/notebook-to-prod-template" },
  { name: "agent-ops",
    ci: "https://github.com/Br111t/agent-ops/actions/workflows/ci.yml/badge.svg?branch=main",
    url: "https://github.com/Br111t/agent-ops" },
  { name: "finrisk-sim-svc",
    ci: "https://github.com/Br111t/finrisk-sim-svc/actions/workflows/ci.yml/badge.svg?branch=main",
    url: "https://github.com/Br111t/finrisk-sim-svc" },
  { name: "wellsrag-advisor",
    ci: "https://github.com/Br111t/wellsrag-advisor/actions/workflows/ci.yml/badge.svg?branch=main",
    url: "https://github.com/Br111t/wellsrag-advisor" },
];

/* ---------- metadata fetch ---------- */
async function getRepoMetadata(repoName) {
  try {
    const [repoInfo, languages, lastHuman] = await Promise.all([
      gh(`https://api.github.com/repos/Br111t/${repoName}`),
      gh(`https://api.github.com/repos/Br111t/${repoName}/languages`),
      lastHumanCommitDate("Br111t", repoName)
    ]);
    
    const languageList = languageListToTwoLines(languages, repoInfo.language);
    
    return {
      lastCommit: lastHuman,
      stars: repoInfo.stargazers_count ?? 0,
      language: languageList
    };
    
  } catch (err) {
    console.error(`[${repoName}] Metadata fetch failed:`, err);
    return { lastCommit: null, stars: 0, language: "❌" };
  }
}

/* ---------- Other utilities ---------- */
function getActivityStatus(lastRunDate) {
  if (!lastRunDate) return "❌ No Data";
  const now = new Date();
  const daysAgo = (now - lastRunDate) / (1000 * 60 * 60 * 24);
  if (daysAgo <= 7) return "🔥 Heating Up";
  if (daysAgo <= 14) return "🟢 Active";
  if (daysAgo > 30) return "❄️ Cold 📉";
  return "❄️ Cold";
}

function checkBadgeExists(badgeUrl) {
  return new Promise((resolve) => {
    https.request(badgeUrl, { method: "HEAD" }, (res) => resolve(res.statusCode !== 404))
         .on("error", () => resolve(false))
         .end();
  });
}

function getActivityRank(activity) {
  if (activity.includes("Heating")) return 0;
  if (activity.includes("Active"))  return 1;
  if (activity.includes("Cold"))    return 2;
  return 3;
}

/* ---------- Build README table ---------- */
/* ---------- Build Projects table block ---------- */
async function buildProjectsBlock() {
  const enrichedRepos = [];

  for (const repo of repos) {
    const meta = await getRepoMetadata(repo.name);

    console.log(
      `[activity] using ${repo.name} lastCommit=`,
      meta.lastCommit ? meta.lastCommit.toISOString() : "null"
    );

    const activity = getActivityStatus(meta.lastCommit);
    console.log(`[activity] ${repo.name} classified as: ${activity}`);

    const ciExists = await checkBadgeExists(repo.ci);
    const ciStatus = ciExists ? `![CI](${repo.ci})` : "🚧 Pending";

    enrichedRepos.push({ ...repo, ...meta, activity, ciStatus });
  }

  const hasStars = enrichedRepos.some(r => r.stars > 0);

  function formatStars(stars, lastCommit) {
    const now = new Date();
    const ageInMonths = lastCommit ? (now - lastCommit) / (1000 * 60 * 60 * 24 * 30) : null;
    if (stars === 0 && ageInMonths !== null && ageInMonths < 2) return "🆕 0";
    if (stars === 0) return "";
    return `⭐ ${stars}`;
  }

  const tableHeader =
`| Project | CI | Activity |${hasStars ? " ⭐ Stars |" : ""} Lang |
|---------|----|----------|${hasStars ? "---------|" : ""}------|`;

  const tableRows = enrichedRepos
    .sort((a, b) => {
      const rankA = getActivityRank(a.activity);
      const rankB = getActivityRank(b.activity);
      if (rankA !== rankB) return rankA - rankB;

      const ciA = a.ciStatus.includes("passing") ? 0 : a.ciStatus.includes("Pending") ? 1 : 2;
      const ciB = b.ciStatus.includes("passing") ? 0 : b.ciStatus.includes("Pending") ? 1 : 2;
      if (ciA !== ciB) return ciA - ciB;

      return a.name.localeCompare(b.name);
    })
    .map(repo =>
      `| [${repo.name}](${repo.url}) | ${repo.ciStatus} | ${repo.activity} |${
        hasStars ? ` ${formatStars(repo.stars, repo.lastCommit)} |` : ""
      } ${repo.language} |`
    )
    .join("\n");

  const stamp = new Date().toISOString().replace("T", " ").replace("Z", " UTC");

  return `<!-- CI-BADGE-START -->
_Last updated: ${stamp}_

${tableHeader}
${tableRows}
<!-- CI-BADGE-END -->`;
}

/* ---------- Build Coursework table block ---------- */
async function buildCourseworkBlock({ org = "Coursework-Archive", windowDays = 60 } = {}) {
  const orgRepos = await listOrgRepos(org);

  const active = orgRepos
    .filter(r => isWithinDays(r.pushed_at, windowDays))
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

  if (active.length === 0) {
    return `<!-- COURSEWORK-START -->\n_No coursework repo pushes in the last ${windowDays} days._\n<!-- COURSEWORK-END -->`;
  }

  const header =
`<!-- COURSEWORK-START -->
| Track | Last Activity |
|-------|---------------|`;

  const rows = active.map(r => {
    const name = r.name;
    const url = r.html_url;
    const badge = `https://img.shields.io/github/last-commit/${org}/${name}?label=last%20commit&style=flat-square`;
    return `| [${name}](${url}) | ![Last Commit](${badge}) |`;
  }).join("\n");

  return `${header}\n${rows}\n<!-- COURSEWORK-END -->`;
}

/* ---------- Main runner ---------- */
async function main() {
  const readmePath = "README.md";
  const readme = fs.readFileSync(readmePath, "utf8");

  // Ensure markers exist
  const ciRegex = /<!-- CI-BADGE-START -->[\s\S]*<!-- CI-BADGE-END -->/;
  const cwRegex = /<!-- COURSEWORK-START -->[\s\S]*<!-- COURSEWORK-END -->/;

  if (!ciRegex.test(readme)) {
    console.error("❌ Missing CI markers in README: <!-- CI-BADGE-START --> ... <!-- CI-BADGE-END -->");
    process.exit(1);
  }
  if (!cwRegex.test(readme)) {
    console.error("❌ Missing coursework markers in README: <!-- COURSEWORK-START --> ... <!-- COURSEWORK-END -->");
    process.exit(1);
  }

  const [projectsBlock, courseworkBlock] = await Promise.all([
    buildProjectsBlock(),
    buildCourseworkBlock({ org: "Coursework-Archive", windowDays: 60 })
  ]);

  let updated = readme.replace(ciRegex, projectsBlock);
  updated = updated.replace(cwRegex, courseworkBlock);

  if (updated === readme) {
    console.log("ℹ️ README unchanged.");
    return;
  }

  fs.writeFileSync(readmePath, updated);
  console.log("✅ README updated (projects + coursework).");
}

main().catch(err => {
  console.error("❌ update-readme failed:", err);
  process.exit(1);
});
