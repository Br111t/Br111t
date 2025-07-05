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

const tableHTML = `
<div align="center">

<table>
  <thead>
    <tr>
      <th>Project</th>
      <th>CI Status</th>
    </tr>
  </thead>
  <tbody>
    ${repos
      .map(
        (r) => `
    <tr>
      <td><a href="${r.url}">${r.name}</a></td>
      <td><img src="${r.ci}" alt="CI Status"/></td>
    </tr>`
      )
      .join("")}
  </tbody>
</table>

</div>`.trim();

const newReadme = readme.replace(
  new RegExp(`${startTag}[\\s\\S]*${endTag}`),
  `${startTag}\n${tableHTML}\n${endTag}`
);

fs.writeFileSync("README.md", newReadme);
console.log("✅ README updated with centered HTML CI badge table.");
