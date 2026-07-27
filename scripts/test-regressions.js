const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("src/ui/maia-app.js");
const horizon = read("src/ui/maia-interface-2.js");
const connect = read("src/ui/maia-connect.html");
const bridge = read("src/bridge/server.js");
const {FILE_TYPE_EXTENSIONS,fileSearchScript}=require("../src/bridge/file-search.js");

const failures = [];
const expect = (condition, message) => { if(!condition) failures.push(message); };

expect(app.includes("modo\\s+(trabalho|jogo|noite|cinema|reuniao|estudo)"), "modos locais não estão protegidos do Home Assistant");
expect(!app.includes('presentation:["modo foco","volume 65"]'), "preset visual antigo de apresentação ainda existe");
for(const mode of ["trabalho","jogo","noite","cinema","reunião","estudo"]){
  expect(app.includes(`"modo ${mode}"`) || app.includes(`modo ${mode}`), `modo ${mode} ausente do motor`);
}
expect(app.includes('status:"pending_confirmation"'), "confirmações pendentes não possuem estado explícito");
expect(app.includes("permission.continuation") && app.includes("Rotina ${label||\"personalizada\"} pausada"), "rotinas não pausam e retomam após confirmação");
expect(app.includes('status:"failed",error:"extensão desativada"'), "extensões desativadas não geram falha real");
expect(app.includes("defaultModeProfiles20") && app.includes("brainModeProfileSave"), "perfis configuráveis dos modos não estão conectados");
expect(app.includes("setupMaxStep20 = 3") && app.includes("validateSetupStep20"), "assistente inicial de quatro etapas não está validado");
expect(app.includes('localStorage.setItem("Maia.onboarding.version","2")'), "conclusão atômica do novo onboarding não está versionada");
expect(app.includes("commandHistoryEnabled") && app.includes("diagnosticsEnabled"), "preferências locais de dados não estão persistidas");
expect(app.includes('event.key === "Escape"&&!setupFirstRun20'), "primeiro acesso ainda pode ser fechado acidentalmente por Esc");
expect(!app.includes("populateCentral20()"), "conclusão do onboarding chama uma função inexistente");
expect(app.includes("backgroundAbortSources20") && app.includes("setup.sync"), "Saúde ainda registra cancelamentos normais ou não protege a sincronização final");
expect(bridge.includes("CommandLine -like ('*' + $profile + '*')"), "recuperação da voz não encerra processos Edge com perfil entre aspas");
expect(horizon.includes('fileType:$("fileType20").value'), "filtro de arquivos não é enviado pela Horizon");
expect(FILE_TYPE_EXTENSIONS.image.includes(".png") && FILE_TYPE_EXTENSIONS.document.includes(".pdf"), "catálogo de tipos de arquivo incompleto");
expect(fileSearchScript("foto","image").includes("'.png'"), "filtro de imagens não chegou ao script real");
expect(!fileSearchScript("foto","document").includes("'.png'"), "filtro de documentos inclui imagens indevidamente");
expect(fileSearchScript("d'agua","").includes("d''agua"), "consulta de arquivo não escapa aspas");
expect(connect.includes('data-routine="meeting"') && connect.includes('data-routine="study"'), "Connect não oferece os seis modos atuais");

if(failures.length){
  console.error("[maia:regressions] FALHOU");
  failures.forEach((failure) => console.error(" - " + failure));
  process.exit(1);
}
console.log("[maia:regressions] OK — modos, confirmações, Connect e filtros protegidos.");
