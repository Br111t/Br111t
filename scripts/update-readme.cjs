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

const readme = fs.readFileSync("README.md", "utf8");

const startTag = "<!-- CI-BADGE-START -->";
const endTag = "<!-- CI-BADGE-END -->";

const markdown = `<!-- CI-BADGE-START -->
<h2 align="center">CI Status</h2>

<p align="center">

| Project | CI Status |
|--------|-----------|
${repos
  .map(
    (r) =>
      `| [${r.name}](${r.url}) | ![CI](${r.ci}) |`
  )
  .join("\n")}

</p>
<!-- CI-BADGE-END -->`.trim();

const updated = readme.replace(
  new RegExp(`${startTag}[\\s\\S]*${endTag}`),
  markdown
);

fs.writeFileSync("README.md", updated);
console.log("✅ README updated with Markdown CI table.");
