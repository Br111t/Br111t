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
  return (c.author?.login || "").toLowerCase() === "br111t";
}

function isBotCommit(c) {
  const login = c.author?.login?.toLowerCase() || "";
  const name  = c.commit?.committer?.name?.toLowerCase() || "";
  const msg   = (c.commit?.message || "").toLowerCase();

  return login.endsWith("[bot]") ||
         login === "github-actions[bot]" ||
         name.includes("github") ||
         msg.includes("dependabot") ||
         msg.includes("auto-update ci status badge") ||
         msg.includes("update badges");
}

async function lastHumanCommitDate(owner, repo, pages = 3) {
  const info = await gh(`https://api.github.com/repos/${owner}/${repo}`);
  const def = info.default_branch || "main";

  for (let page = 1; page <= pages; page++) {
    const list = await gh(`https://api.github.com/repos/${owner}/${repo}/commits?sha=${def}&per_page=100&page=${page}`);
    if (!Array.isArray(list) || list.length === 0) break;
    
        // 1) Prefer YOUR commit (not a bot)
    let chosen = list.find(c => isMyCommit(c) && !isBotCommit(c));

        // 2) Fallback: any non-bot commit
    if (!chosen) chosen = list.find(c => !isBotCommit(c));
    
    if (chosen) {
      const d = new Date(chosen.commit.committer.date);
      console.log(`[activity] ${owner}/${repo} -> ${d.toISOString()} by ${chosen.author?.login} | "${(chosen.commit?.message || "").slice(0,80)}"`);
      return d;
    }
  }
  console.log(`[activity] ${owner}/${repo} -> no qualifying commits found on ${def}`);
  return null;
}

function getLanguageEmoji(language) {
  const map = {
    "Python": "🐍",
    "Java": "☕",
    "JavaScript": "🟨",
    "TypeScript": "🔷",
    "HTML": "🌐",
    "CSS": "🎨",
    "Shell": "🐚",
    "Dockerfile": "🐳",
    "Jupyter Notebook": "📓",
    "Go": "💙",
    "C++": "➕➕",
    "C#": "🎯",
    "C": "📘",
    "Rust": "🦀"
  };
  return map[language] || "";
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

/* ---------- Patched metadata fetch ---------- */
async function getRepoMetadata(repoName) {
  try {
    const [repoInfo, languages, lastHuman] = await Promise.all([
      gh(`https://api.github.com/repos/Br111t/${repoName}`),
      gh(`https://api.github.com/repos/Br111t/${repoName}/languages`),
      lastHumanCommitDate("Br111t", repoName)
    ]);

    const languageList = Object.keys(languages)
      .map(lang => `${getLanguageEmoji(lang)} ${lang}`)
      .join(", ");

    return {
      lastCommit: lastHuman,                           // human commit on default branch
      stars: repoInfo.stargazers_count ?? 0,
      language: languageList || "❌"
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
async function buildTable() {
  const enrichedRepos = [];

  for (const repo of repos) {
    const meta = await getRepoMetadata(repo.name);

    // DEBUG: show what commit/date we’re classifying
    console.log(
      `[activity] using ${repo.name} lastCommit=`,
      meta.lastCommit ? meta.lastCommit.toISOString() : "null"
    );

    const activity = getActivityStatus(meta.lastCommit);
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

  const tableHeader = `| Project | CI Status | Activity |${hasStars ? " ⭐ Stars |" : ""} 🧠 Language |
|---------|-----------|----------|${hasStars ? "---------|" : ""}-------------|`;

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

  const markdown = `<!-- CI-BADGE-START -->
${tableHeader}
${tableRows}
<!-- CI-BADGE-END -->`;

  const readme = fs.readFileSync("README.md", "utf8");
  const updated = readme.replace(/<!-- CI-BADGE-START -->[\s\S]*<!-- CI-BADGE-END -->/, markdown);
  fs.writeFileSync("README.md", updated);
  console.log("✅ README updated with CI, activity, stars, and language metadata.");
}

buildTable();
