"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const failures = [];

function requireFile(relativePath) {
  if (!fs.existsSync(path.join(root, relativePath))) failures.push(`arquivo ausente: ${relativePath}`);
}

[
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "docs/BETA.md",
  "docs/CHANGELOG.md",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/RELEASE_TEMPLATE.md"
].forEach(requireFile);

const author = typeof pkg.author === "object" ? pkg.author.name : pkg.author;
if (author !== "clchucro") failures.push("autor do package.json deve ser clchucro");
if (!String(pkg.version).includes("-beta.")) failures.push("a versão de publicação deve identificar o canal beta");

const ui = fs.readFileSync(path.join(root, "src/ui/maia.html"), "utf8");
const horizonUi = fs.readFileSync(path.join(root, "src/ui/maia-interface-2.html"), "utf8");
const changelog = fs.readFileSync(path.join(root, "docs/CHANGELOG.md"), "utf8");
if (!ui.includes(`Versão:</b> ${pkg.version}`)) failures.push("versão da tela Sobre está diferente do pacote");
if (!ui.includes(`NOVIDADES • MAIA ${pkg.version}`)) failures.push("versão das Novidades está diferente do pacote");
if (!horizonUi.includes(pkg.version)) failures.push("versão visível da Horizon está diferente do pacote");
if (!ui.includes("<title>MAIA Horizon</title>")) failures.push("título principal ainda não identifica a Horizon");
if (!changelog.includes(`## ${pkg.version}`)) failures.push("versão ausente no changelog");

for (const privateName of [".env", "arkama-webhook.json", "netlify-sales.json", "home-assistant.json", "mobility.json"]) {
  if (fs.existsSync(path.join(root, privateName))) failures.push(`arquivo privado na raiz: ${privateName}`);
}

if (failures.length) {
  console.error(`[maia:release] BLOQUEADO — ${failures.length} problema(s):`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`[maia:release] OK — ${pkg.version} pronta para revisão da beta.`);
