const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const requiredFiles = [
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "docs/BETA.md",
  "assets/maia-icon.png",
  "src/main/main.js",
  "src/preload/floating-preload.js",
  "src/ui/maia.html",
  "src/ui/maia.css",
  "src/ui/maia-app.js",
  "src/ui/maia-interface-2.html",
  "src/ui/maia-theme-bootstrap.js",
  "src/ui/maia-interface-2.js",
  "src/ui/maia-floating-button.html",
  "src/ui/maia-connect.html",
  "src/bridge/server.js",
  "src/bridge/network-scanner.js",
  "src/config/maia-commands.json",
  "src/config/maia-extensions.json",
  "src/config/update.json",
  "docs/CHANGELOG.md",
];

const errors = [];
const fail = (message) => errors.push(message);

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    fail(`Arquivo obrigatório ausente: ${relativePath}`);
  }
}

for (const relativePath of ["package.json", "src/config/maia-commands.json", "src/config/maia-extensions.json", "src/config/update.json"]) {
  try {
    JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
  } catch (error) {
    fail(`JSON inválido em ${relativePath}: ${error.message}`);
  }
}

try {
  const packageData = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const packageVersion = packageData.version;
  const ui = [
    "src/ui/maia.html",
    "src/ui/maia.css",
    "src/ui/maia-app.js",
  ].map((relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")).join("\n");
  const floatingUi = fs.readFileSync(path.join(root, "src/ui/maia-floating-button.html"), "utf8");
  const secondUi = fs.readFileSync(path.join(root, "src/ui/maia-interface-2.html"), "utf8");
  const secondUiScript = fs.readFileSync(path.join(root, "src/ui/maia-interface-2.js"), "utf8");
  if (!floatingUi) fail("Interface flutuante vazia.");
  if (packageData.dependencies && packageData.dependencies.three) fail("Three.js ainda aparece nas dependências do pacote.");
  if (!ui.includes("<title>MAIA Horizon</title>") || /N[úÃº]cleo Online/i.test(ui)) fail("Identidade antiga ainda aparece na interface principal.");
  if (!ui.includes("maiaInterfaceLayer") || !ui.includes("Maia.interface")) fail("Troca persistente da segunda interface não está configurada.");
  if (!ui.includes('setMaiaInterface20("modern")')) fail("A Horizon não está configurada como interface única.");
  if (!ui.includes('window.__maiaVisualEngine = "disabled"') || ui.includes("maia-visual.js") || ui.includes("new THREE.")) fail("O motor 3D ainda é carregado na Horizon.");
  if (!secondUi.includes("./maia-interface-2.js") || !secondUiScript.includes("maia-interface-command")) fail("Interface Horizon não está conectada ao núcleo da Maia.");
  if (!secondUi.includes(packageVersion)) fail(`Versão ${packageVersion} não aparece na Horizon.`);
  if (secondUi.includes("api.anthropic.com") || secondUiScript.includes("api.anthropic.com")) fail("A API demonstrativa externa ainda está presente na segunda interface.");
  if (secondUi.includes("Sensor Perimetral") || secondUi.includes("backup_memoria.bin") || secondUi.includes(">23%</span>")) fail("Dados demonstrativos ainda aparecem na Horizon.");
  if (!secondUiScript.includes("maia-interface-form") || !ui.includes("horizonControlSnapshot20")) fail("Formulários completos da Horizon não estão sincronizados.");
  if (!secondUi.includes("horizonBootProgress") || !secondUiScript.includes("maia-interface-theme") || !ui.includes("horizonThemePayload20")) fail("Tema e carregamento adaptativo da Horizon não estão completos.");
  if (!secondUiScript.includes("horizon-category-nav") || !secondUiScript.includes("data-horizon-category-tab")) fail("Categorias compactas de Config. não estão configuradas.");
  if (!secondUi.includes("activeThemeName") || !secondUiScript.includes('"selectstart"')) fail("Tema ativo e proteção de seleção da Horizon não estão configurados.");
  if (!secondUi.includes("#app.compact .view") || !secondUi.includes("#app.compact .horizon-form")) fail("Modo compacto visual da Horizon não está completo.");
  if (!ui.includes("readLocalJson") || !ui.includes("state.preferences.wakeWords || DEFAULT_WAKE_WORDS")) fail("Recuperação e persistência segura das preferências não estão completas.");
  if (!ui.includes("configuredVoiceName") || !ui.includes("preferredRate / 100")) fail("Preferências reais da voz não estão conectadas à fala.");
  const themeCatalogBlock = ui.match(/id="brainTheme">([\s\S]*?)<\/select>/);
  const themeIds = themeCatalogBlock ? [...themeCatalogBlock[1].matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]) : [];
  const uniqueThemeIds = new Set(themeIds);
  if(themeIds.length !== 61 || uniqueThemeIds.size !== 61) fail(`Catálogo de temas inválido: ${themeIds.length} opções e ${uniqueThemeIds.size} IDs únicos.`);
  const surfaceSource = ui.match(/const baseThemeSurfaces20 = \{([\s\S]*?)\};\s*const newThemeDefinitions20 = \{([\s\S]*?)\};/);
  if(!surfaceSource){
    fail("Definições completas dos temas não foram encontradas.");
  }else{
    const entries = [...(surfaceSource[1] + "\n" + surfaceSource[2]).matchAll(/(?:^|\n)\s*([a-z][a-z0-9]*):\{([^{}]+)\}/g)];
    const definedIds = new Set(entries.map((match) => match[1]));
    const missing = themeIds.filter((id) => !definedIds.has(id));
    if(missing.length) fail("Temas sem superfície própria: " + missing.join(", ") + ".");
    const signatures = new Map();
    for(const match of entries){
      const values = [...match[2].matchAll(/(?:cyan|amber|soft|dim|bg1|bg2):"([^"]+)"/g)].map((item) => item[1].toLowerCase());
      const signature = values.join("|");
      if(signatures.has(signature)) fail(`Paleta repetida entre ${signatures.get(signature)} e ${match[1]}.`);
      signatures.set(signature, match[1]);
    }
  }
  const missingFloatingThemes = themeIds.filter((id) => !floatingUi.includes(`"${id}"`) && !floatingUi.includes(`${id}:[`));
  if(missingFloatingThemes.length) fail("Temas ausentes no flutuante: " + missingFloatingThemes.join(", ") + ".");
  const connectUi = fs.readFileSync(path.join(root, "src/ui/maia-connect.html"), "utf8");
  if (!connectUi.includes("initial-scale=1") || !connectUi.includes("minimum-scale=1")) fail("Escala padrão 1× do Maia Connect não está configurada.");
  if (connectUi.includes("initial-scale=.5") || connectUi.includes("iphone7-scale")) fail("A antiga escala 0,50× do iPhone ainda está presente.");
  if (!connectUi.includes("user-scalable=no") || !connectUi.includes("gesturestart")) fail("Bloqueio de zoom acidental do Maia Connect não está completo.");
  if (!connectUi.includes("isIPhone") || !connectUi.includes("isAndroid") || !connectUi.includes("voice-hidden")) fail("Disponibilidade inteligente da voz móvel não está configurada.");
  if (!connectUi.includes("mediaDevices.getUserMedia({audio:true})") || !connectUi.includes("window.isSecureContext")) fail("Permissão segura do microfone no Android não está configurada.");
  if (!ui.includes("brainHaConnect") || !ui.includes("integration.homeAssistant.configure")) fail("Painel completo do Home Assistant não está configurado.");
  if (!ui.includes("brainWeatherTest") || !ui.includes("traffic.route")) fail("Painel de Clima e Trânsito não está configurado.");
  if (!ui.includes('data-central-tab="integracoes"') || !ui.includes("selectCentralTab")) fail("Central por abas não está configurada.");
  if (
    !ui.includes("ATIVAR MODO ECONOMIA") ||
    !secondUi.includes("performance-economy") ||
    !ui.includes('window.__maiaVisualEngine = "disabled"')
  ) fail("Perfis Normal/Economia e desativação do motor visual não estão completos.");
  if (!ui.includes(".brain-console.open{ z-index:120; }") || !ui.includes("isolation:isolate")) fail("Correção de camada da Central não está configurada.");
  const bridgeSource = fs.readFileSync(path.join(root, "src/bridge/server.js"), "utf8");
  if (!bridgeSource.includes("--purple:#a78bfa") || bridgeSource.includes("body::before{content:")) fail("Site auxiliar de voz não está adaptado ao fundo roxo limpo.");
  for (const capability of ["homeAssistantEntities", "homeAssistantControl", "completeWeather", "trafficRoute", "TRAFFIC_AWARE_OPTIMAL"]) {
    if (!bridgeSource.includes(capability)) fail(`Integração nova incompleta: ${capability}.`);
  }
  if (
    !bridgeSource.includes("if(!readNetlifySalesConfig()) return;") ||
    !bridgeSource.includes("fs.writeFileSync(netlifySalesConfigPath()") ||
    !bridgeSource.includes("startNetlifySalesPolling();")
  ) fail("Polling configurado da Arkama/Netlify não está protegido.");
  const changelog = fs.readFileSync(path.join(root, "docs/CHANGELOG.md"), "utf8");
  if (!ui.includes(`Versão:</b> ${packageVersion}`)) fail(`Versão ${packageVersion} não aparece na tela Sobre.`);
  if (!ui.includes(`NOVIDADES • MAIA ${packageVersion}`)) fail(`Versão ${packageVersion} não aparece nas novidades da Central.`);
  if (!changelog.includes(`## ${packageVersion}`)) fail(`Versão ${packageVersion} não aparece em docs/CHANGELOG.md.`);
  const themeSelect = ui.match(/<select class="brain-select" id="brainTheme">([\s\S]*?)<\/select>/);
  if (!themeSelect) {
    fail("Seletor de temas não encontrado.");
  } else {
    const themeIds = [...themeSelect[1].matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]);
    const exclusiveThemes = (themeSelect[1].match(/Exclusivo/g) || []).length;
    if (themeIds.length !== 61) fail(`Catálogo visual deve ter 61 temas; encontrados ${themeIds.length}.`);
    if (new Set(themeIds).size !== themeIds.length) fail("Existem identificadores de tema duplicados.");
    if (exclusiveThemes !== 16) fail(`Catálogo deve ter 16 temas exclusivos; encontrados ${exclusiveThemes}.`);
    for (const themeId of themeIds) {
      if (!floatingUi.includes(themeId)) fail(`Tema "${themeId}" não está sincronizado com o núcleo flutuante.`);
    }
  }
} catch (error) {
  fail(`Não foi possível validar a sincronização da versão: ${error.message}`);
}

const jsFiles = [];
function collectJavaScript(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectJavaScript(fullPath);
    else if (entry.isFile() && entry.name.endsWith(".js")) jsFiles.push(fullPath);
  }
}

collectJavaScript(path.join(root, "src"));
for (const file of jsFiles) {
  try {
    new vm.Script(fs.readFileSync(file, "utf8"), { filename: file });
  } catch (error) {
    fail(`JavaScript inválido em ${path.relative(root, file)}: ${error.message}`);
  }
}

for (const relativePath of ["src/ui/maia.html", "src/ui/maia-floating-button.html", "src/ui/maia-connect.html"]) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) continue;
  const html = fs.readFileSync(fullPath, "utf8");
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  scripts.forEach((match, index) => {
    try {
      new vm.Script(match[1], { filename: `${relativePath}#script-${index + 1}` });
    } catch (error) {
      fail(`Script inválido em ${relativePath}: ${error.message}`);
    }
  });
}

const forbiddenNames = ["orvix", "jarvis"];
for (const relativePath of requiredFiles.filter((file) => /\.(?:js|html|json)$/i.test(file))) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) continue;
  const content = fs.readFileSync(fullPath, "utf8").toLowerCase();
  for (const name of forbiddenNames) {
    if (content.includes(name)) fail(`Nome antigo "${name}" encontrado em ${relativePath}`);
  }
}

if (errors.length) {
  console.error(`[maia:check] FALHOU — ${errors.length} problema(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`[maia:check] OK — ${requiredFiles.length} arquivos essenciais e ${jsFiles.length} arquivos JavaScript verificados.`);
