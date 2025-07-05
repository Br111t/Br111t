const fs = require("fs");

const repos = [
  {
    name: "notebook-to-prod-template",
    ci: "https://github.com/Br111t/notebook-to-prod-template/actions/workflows/ci.yml/badge.svg?branch=main",
    url: "https://github.com/Br111t/notebook-to-prod-template",
  },
  {
    name: "agent-ops",
    ci: "https://github.com/Br111t/agent-ops/actions/workflows/ci.yml/badge.svg?branch=main",
    url: "https://github.com/Br111t/agent-ops",
  },
];

const readme = fs.readFileSync("README.md", "utf-8");

const startTag = "<!-- CI-BADGE-START -->";
const endTag = "<!-- CI-BADGE-END -->";

const table = `| Project | CI Status |
|---------|-----------|
${repos
  .map(
    (r) => `| [${r.name}](${r.url}) | ![CI](${r.ci}) |`
  )
  .join("\n")}`;

const newReadme = readme.replace(
  new RegExp(`${startTag}[\\s\\S]*${endTag}`),
  `${startTag}\n${table}\n${endTag}`
);

fs.writeFileSync("README.md", newReadme);
console.log("✅ README updated.");
