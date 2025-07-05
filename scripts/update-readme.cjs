const fs = require("fs");
const https = require("https");
const fetch = require("node-fetch");

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

async function getLastCommitDate(repoName) {
  const url = `https://api.github.com/repos/Br111t/${repoName}/commits?per_page=1`;
  try {
    const res = await fetch(url);
    console.log(`[${repoName}] Status:`, res.status);
    if (!res.ok) return null;
    const data = await res.json();
    const dateStr = data[0]?.commit?.committer?.date;
    console.log(`[${repoName}] Last Commit:`, dateStr);
    return dateStr ? new Date(dateStr) : null;
  } catch (err) {
    console.error(`[${repoName}] Failed to fetch:`, err);
    return null;
  }
}

function getActivityStatus(lastRunDate) {
  if (!lastRunDate) return "⬜ Inactive";
  const now = new Date();
  const daysAgo = (now - lastRunDate) / (1000 * 60 * 60 * 24);
  return daysAgo <= 14 ? "🟢 Active" : "⬜ Inactive";
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

async function buildTable() {
  const enrichedRepos = await Promise.all(
    repos.map(async (repo) => {
      const lastRunDate = await getLastCommitDate(repo.name);
      const activity = getActivityStatus(lastRunDate);
      const ciExists = await checkBadgeExists(repo.ci);
      const ciStatus = ciExists ? `![CI](${repo.ci})` : "🚧 Pending";
      return { ...repo, activity, ciStatus };
    })
  );

  const tableHeader = `| Project | CI Status | Activity |
|---------|-----------|----------|`;

  const tableRows = enrichedRepos
    .sort((a, b) => {
      if (a.activity === b.activity) return a.name.localeCompare(b.name);
      return a.activity === "🟢 Active" ? -1 : 1;
    })
    .map(repo => `| [${repo.name}](${repo.url}) | ${repo.ciStatus} | ${repo.activity} |`)
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
  console.log("✅ README updated with CI dashboard including activity status.");
}

buildTable();
