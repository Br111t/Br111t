const fs = require("fs");
const https = require("https");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const repos = [
  {
    name: "notebook-to-prod-template",
    ci: "https://github.com/Br111t/notebook-to-prod-template/actions/workflows/ci.yml/badge.svg?branch=main",
    url: "https://github.com/Br111t/notebook-to-prod-template"
  },
  {
    name: "agent-ops",
    ci: "https://github.com/Br111t/agent-ops/actions/workflows/ci.yml/badge.svg?branch=main",
    url: "https://github.com/Br111t/agent-ops"
  },
  {
    name: "finrisk-sim-svc",
    ci: "https://github.com/Br111t/finrisk-sim-svc/actions/workflows/ci.yml/badge.svg?branch=main",
    url: "https://github.com/Br111t/finrisk-sim-svc"
  },
  {
    name: "wellsrag-advisor",
    ci: "https://github.com/Br111t/wellsrag-advisor/actions/workflows/ci.yml/badge.svg?branch=main",
    url: "https://github.com/Br111t/wellsrag-advisor"
  }
];

async function getRepoMetadata(repoName) {
  const repoUrl = `https://api.github.com/repos/Br111t/${repoName}`;
  const commitsUrl = `https://api.github.com/repos/Br111t/${repoName}/commits?per_page=1`;
  const languagesUrl = `https://api.github.com/repos/Br111t/${repoName}/languages`;

  try {
    const [commitsRes, repoRes, langsRes] = await Promise.all([
      fetch(commitsUrl),
      fetch(repoUrl),
      fetch(languagesUrl)
    ]);

    if (!commitsRes.ok || !repoRes.ok || !langsRes.ok) throw new Error("Bad API response");

    const commits = await commitsRes.json();
    const repoInfo = await repoRes.json();
    const languages = await langsRes.json();

    const dateStr = commits[0]?.commit?.committer?.date;

    const languageList = Object.keys(languages)
      .map(lang => `${getLanguageEmoji(lang)} ${lang}`)
      .join(", ");

    return {
      lastCommit: dateStr ? new Date(dateStr) : null,
      stars: repoInfo.stargazers_count ?? 0,
      language: languageList || "❌"
    };
  } catch (err) {
    console.error(`[${repoName}] Metadata fetch failed:`, err);
    return { lastCommit: null, stars: 0, language: "❌" };
  }
}


function getActivityStatus(lastRunDate) {
  if (!lastRunDate) return "❌ No Data";
  const now = new Date();
  const daysAgo = (now - lastRunDate) / (1000 * 60 * 60 * 24);

  if (daysAgo <= 7) return "🔥 Heating Up";
  if (daysAgo <= 14) return "🟢 Active";
  if (daysAgo > 30) return "❄️ Cold 📉";
  return "❄️ Cold";
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


function formatStars(stars) {
  return stars === 0 ? "🆕 0" : stars;
}


function checkBadgeExists(badgeUrl) {
  return new Promise((resolve) => {
    https
      .request(badgeUrl, { method: "HEAD" }, (res) => {
        resolve(res.statusCode !== 404);
      })
      .on("error", () => resolve(false))
      .end();
  });
}

function getActivityRank(activity) {
  if (activity.includes("Heating")) return 0;
  if (activity.includes("Active")) return 1;
  if (activity.includes("Cold")) return 2;
  return 3; // No data or unknown
}

async function buildTable() {
  const enrichedRepos = await Promise.all(
    repos.map(async (repo) => {
      const meta = await getRepoMetadata(repo.name);
      const activity = getActivityStatus(meta.lastCommit);
      const ciExists = await checkBadgeExists(repo.ci);
      const ciStatus = ciExists ? `![CI](${repo.ci})` : "🚧 Pending";
      return { ...repo, ...meta, activity, ciStatus };
    })
  );

  const tableHeader = `| Project | CI Status | Activity | ⭐ Stars | 🧠 Language |
|---------|-----------|----------|---------|-------------|`;

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
      `| [${repo.name}](${repo.url}) | ${repo.ciStatus} | ${repo.activity} | ${formatStars(repo.stars)} | ${getLanguageEmoji(repo.language)} ${repo.language} |`
    )
    .join("\n");

  const markdown = `<!-- CI-BADGE-START -->
${tableHeader}
${tableRows}
<!-- CI-BADGE-END -->`;

  const readme = fs.readFileSync("README.md", "utf8");
  const updated = readme.replace(
    new RegExp(`<!-- CI-BADGE-START -->[\\s\\S]*<!-- CI-BADGE-END -->`),
    markdown
  );

  fs.writeFileSync("README.md", updated);
  console.log("✅ README updated with CI, activity, stars, and language metadata.");
}

buildTable();

