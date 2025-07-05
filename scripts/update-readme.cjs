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

const startTag = "<!-- CI-BADGE-START -->";
const endTag = "<!-- CI-BADGE-END -->";

// Read current README
const readme = fs.readFileSync("README.md", "utf8");

// Optional: guard if tags are missing
if (!readme.includes(startTag) || !readme.includes(endTag)) {
  console.error("❌ CI badge section not found in README.md");
  process.exit(1);
}

// New HTML block to insert
const html = `
<!-- CI-BADGE-START -->
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

</div>
<!-- CI-BADGE-END -->
`.trim();

// 🔁 This is the line you asked about — it does the actual replacement
const updated = readme.replace(
  new RegExp(`${startTag}[\\s\\S]*${endTag}`),
  html
);

// Save the updated file
fs.writeFileSync("README.md", updated);

console.log("✅ README updated with centered HTML table.");
