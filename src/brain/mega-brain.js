const fs = require("fs");
const os = require("os");
const path = require("path");

const MAX_TURNS = 6;
const MAX_MEMORIES = 80;

const TOOL_CATALOG = Object.freeze([
  {name:"system.openProgram", risk:"low", description:"Abre um programa instalado"},
  {name:"system.closeProgram", risk:"sensitive", description:"Fecha um programa"},
  {name:"spotify.playSearch", risk:"low", description:"Toca uma musica no Spotify"},
  {name:"spotify.queueSearch", risk:"low", description:"Adiciona musica a fila"},
  {name:"volume.set", risk:"low", description:"Ajusta o volume de 0 a 100"},
  {name:"youtube.play", risk:"low", description:"Pesquisa e abre um video"},
  {name:"file.search", risk:"sensitive", description:"Pesquisa arquivos do usuario"},
  {name:"clipboard.read", risk:"sensitive", description:"Le a area de transferencia"},
  {name:"clipboard.write", risk:"sensitive", description:"Altera a area de transferencia"},
  {name:"screenshot.capture", risk:"sensitive", description:"Captura a tela"},
  {name:"system.lock", risk:"critical", description:"Bloqueia o computador"},
  {name:"system.sleep", risk:"critical", description:"Suspende o computador"},
  {name:"system.restart", risk:"critical", description:"Reinicia o computador"},
  {name:"system.shutdown", risk:"critical", description:"Desliga o computador"}
]);

const {COUNTRIES, TOPICS, PROGRAMMING_COURSE, PROGRAMMING_QUIZZES} = require('./knowledge-pack.js');
const {LEARNING_TRACKS} = require('./life-skills-pack.js');

function brainDataPath(){
  const currentDir = path.join(os.homedir(), ".maia");
  return path.join(currentDir, "mega-brain.json");
}

function cleanText(value, max = 4000){
  return String(value || "").replace(/\0/g, "").trim().slice(0, max);
}

function safeRead(file){
  try{
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  }catch(err){
    return {};
  }
}

function extractJson(text){
  const raw = cleanText(text, 20000);
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  try{ return JSON.parse(candidate); }catch(err){ return null; }
}

function normalizeKnowledge(value){
  return cleanText(value, 2000).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9%\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function memoryCategory(text){
  const value = normalizeKnowledge(text);
  if(/\b(gosto|prefiro|favorito|nao gosto)\b/.test(value)) return 'preferencia';
  if(/\b(meu nome|moro|nasci|trabalho|idade|familia)\b/.test(value)) return 'pessoal';
  if(/\b(projeto|objetivo|meta|prazo)\b/.test(value)) return 'projeto';
  if(/\b(aprender|estudar|curso|aula)\b/.test(value)) return 'aprendizado';
  if(/\b(contato|telefone|email|pessoa)\b/.test(value)) return 'pessoa';
  return 'conhecimento';
}

const LOCAL_KNOWLEDGE = Object.freeze([
  {topic:'identidade', patterns:[/quem (e|eh) voce/, /o que voce (e|eh)/], short:'Sou Maia, sua assistente pessoal.', detail:'Fui projetado para compreender comandos, guardar informações ensinadas e ajudar com tarefas do computador.'},
  {topic:'criador', patterns:[/quem te criou/, /quem criou voce/, /quem te fez/], short:'Sou Maia, sua assistente pessoal.', detail:'Meu núcleo, interface, memória, comandos e integrações foram criados para acompanhar você.'},
  {topic:'capacidades', patterns:[/o que voce (faz|sabe fazer)/, /suas capacidades/, /como pode me ajudar/], short:'Posso controlar programas e mídia, criar lembretes, calcular, consultar clima, horários, notícias, rede e guardar conhecimentos ensinados.', detail:'Também mantenho preferências, contexto recente, comandos personalizados e peço confirmação antes de ações perigosas.'},
  {topic:'computador', patterns:[/como funciona um computador/, /o que (e|eh) um computador/], short:'Um computador recebe dados, executa instruções e produz resultados usando processador, memória e armazenamento.', detail:'A CPU executa operações, a RAM mantém dados temporários, o armazenamento preserva arquivos e o sistema operacional coordena o conjunto.'},
  {topic:'internet', patterns:[/como funciona a internet/, /o que (e|eh) a internet/], short:'A internet é uma rede mundial de redes que troca dados por protocolos padronizados.', detail:'DNS traduz nomes em endereços, roteadores encaminham pacotes e protocolos como HTTPS protegem a comunicação entre navegador e servidor.'},
  {topic:'programacao', patterns:[/o que (e|eh) programacao/, /como aprender programacao/, /quero programar/], short:'Programação é transformar um problema em instruções que o computador consegue executar.', detail:'Comece por lógica, escolha uma linguagem, faça projetos pequenos e pratique depuração. JavaScript ou Python são portas de entrada acessíveis.'},
  {topic:'javascript', patterns:[/o que (e|eh) javascript/, /para que serve javascript/], short:'JavaScript é uma linguagem usada em páginas web, servidores e aplicativos desktop.', detail:'Nesta Maia, JavaScript controla a interface Electron, interpreta comandos e conecta os módulos locais.'},
  {topic:'seguranca digital', patterns:[/como me proteger na internet/, /seguranca digital/, /evitar golpe/, /senha segura/], short:'Use senhas únicas, autenticação em dois fatores, atualizações e desconfie de links ou pedidos urgentes.', detail:'Nunca entregue códigos de verificação. Confirme remetente e endereço do site; para senhas, prefira um gerenciador confiável.'},
  {topic:'pix', patterns:[/o que (e|eh) pix/, /como funciona o pix/], short:'Pix é o sistema brasileiro de pagamentos instantâneos operado pelo Banco Central.', detail:'As transferências usam chaves ou dados bancários e normalmente são liquidadas em segundos, todos os dias.'},
  {topic:'brasil', patterns:[/capital do brasil/, /qual (e|eh) a capital brasileira/], short:'A capital do Brasil é Brasília.', detail:'Brasília foi inaugurada em 21 de abril de 1960 e fica no Distrito Federal.'},
  {topic:'sistema solar', patterns:[/planetas do sistema solar/, /sistema solar/], short:'Os planetas são Mercúrio, Vênus, Terra, Marte, Júpiter, Saturno, Urano e Netuno.', detail:'Eles orbitam o Sol; os quatro primeiros são rochosos e os quatro externos são gigantes gasosos ou gelados.'},
  {topic:'terra', patterns:[/por que o ceu (e|eh) azul/, /ceu azul/], short:'O céu parece azul porque a atmosfera espalha mais a luz azul do Sol do que as cores de maior comprimento de onda.', detail:'Esse fenômeno é chamado espalhamento de Rayleigh; no pôr do sol, o caminho maior pela atmosfera favorece tons vermelhos e alaranjados.'},
  {topic:'agua', patterns:[/formula da agua/, /o que (e|eh) h2o/], short:'A fórmula da água é H₂O: dois átomos de hidrogênio e um de oxigênio.', detail:'Sua geometria molecular e polaridade explicam propriedades importantes, como dissolver muitas substâncias.'},
  {topic:'fotossintese', patterns:[/o que (e|eh) fotossintese/, /como funciona a fotossintese/], short:'Fotossíntese é o processo pelo qual plantas, algas e algumas bactérias convertem luz em energia química.', detail:'Em termos gerais, usam água e dióxido de carbono para produzir açúcares e liberar oxigênio.'},
  {topic:'produtividade', patterns:[/como ser mais produtivo/, /me ajude a focar/, /nao consigo focar/, /procrastinacao/], short:'Escolha uma única tarefa pequena, elimine distrações e trabalhe por 25 minutos antes de revisar o progresso.', detail:'Defina o próximo passo de forma concreta. Uma tarefa como abrir o documento e escrever três linhas reduz mais resistência que uma meta vaga.'},
  {topic:'estudos', patterns:[/como estudar melhor/, /tecnica de estudo/, /aprender mais rapido/], short:'Estude com recuperação ativa: feche o material e tente explicar o conteúdo com suas palavras.', detail:'Combine revisão espaçada, exercícios e sono adequado. Reler passivamente dá sensação de domínio, mas testar-se fixa melhor.'},
  {topic:'sono', patterns:[/como dormir melhor/, /estou sem sono/, /insonia/], short:'Mantenha horário regular, reduza luz intensa à noite e evite cafeína nas horas próximas ao sono.', detail:'Se a dificuldade for persistente ou intensa, procure orientação médica; eu não substituo avaliação profissional.'},
  {topic:'ansiedade', patterns:[/estou ansioso/, /estou com ansiedade/, /me acalmar/], short:'Respire lentamente, apoie os pés no chão e concentre-se no próximo passo controlável.', detail:'Se houver sofrimento intenso, recorrente ou risco imediato, procure uma pessoa de confiança e atendimento profissional ou emergencial.'},
  {topic:'financas', patterns:[/como economizar dinheiro/, /organizar minhas financas/, /controle financeiro/], short:'Registre gastos, separe despesas essenciais e defina uma transferência automática para reserva.', detail:'Priorize quitar dívidas caras e formar uma reserva de emergência. Decisões de investimento devem considerar prazo e risco.'},
  {topic:'rede', patterns:[/o que (e|eh) dns/, /como funciona dns/], short:'DNS é o sistema que converte nomes como exemplo.com em endereços IP.', detail:'Ele funciona de forma hierárquica e pode usar cache para acelerar consultas; DNS seguro reduz adulteração e espionagem local.'},
  {topic:'privacidade', patterns:[/o que (e|eh) vpn/, /para que serve vpn/], short:'Uma VPN cria um túnel criptografado entre seu dispositivo e um servidor VPN.', detail:'Ela protege o tráfego em redes locais, mas não torna ninguém anônimo e exige confiança no provedor.'},
  {topic:'arquivos', patterns:[/o que (e|eh) backup/, /como fazer backup/], short:'Backup é uma cópia separada dos seus dados para recuperação após falha, perda ou ataque.', detail:'A regra 3-2-1 recomenda três cópias, em dois tipos de mídia, com uma cópia fora do local principal.'},
  {topic:'git', patterns:[/o que (e|eh) git/, /para que serve git/], short:'Git é um sistema de controle de versão que registra mudanças em arquivos.', detail:'Commits criam pontos históricos, branches isolam linhas de trabalho e merges combinam alterações.'},
  {topic:'electron', patterns:[/o que (e|eh) electron/, /como funciona electron/], short:'Electron permite criar aplicativos desktop com HTML, CSS e JavaScript.', detail:'Ele combina Chromium para a interface e Node.js para recursos locais; esta Maia é um aplicativo Electron.'}
]);

function editDistance(left, right){
  const a = normalizeKnowledge(left);
  const b = normalizeKnowledge(right);
  const row = Array.from({length:b.length + 1}, (_, index) => index);
  for(let i = 1; i <= a.length; i++){
    let previous = row[0];
    row[0] = i;
    for(let j = 1; j <= b.length; j++){
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}

function findPackedTopic(text){
  const normalized = normalizeKnowledge(text);
  let best = null;
  let bestScore = 0;
  for(const item of TOPICS){
    for(const alias of item.aliases){
      const key = normalizeKnowledge(alias);
      let score = normalized.includes(key) ? 100 + key.length : 0;
      if(!score){
        const words = normalized.split(' ');
        const keyWords = key.split(' ');
        const hits = keyWords.filter(target => words.some(word => word === target || (target.length > 5 && editDistance(word, target) <= 2))).length;
        score = Math.round((hits / keyWords.length) * 80);
      }
      if(score > bestScore){ best = item; bestScore = score; }
    }
  }
  return bestScore >= 70 ? best : null;
}

function findCountry(text){
  const normalized = normalizeKnowledge(text)
    .replace(/\beua\b/g, 'estados unidos')
    .replace(/\binglaterra\b/g, 'reino unido');
  return Object.entries(COUNTRIES)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([key]) => normalized.includes(normalizeKnowledge(key))) || null;
}

function answerLearningTrack(text, state){
  const normalized = normalizeKnowledge(text);
  const entries = Object.entries(LEARNING_TRACKS);
  let selected = entries.find(([, track]) => track.aliases.some(alias => normalized.includes(normalizeKnowledge(alias))));
  if(!selected && /\b(proxima aula|continuar aula|onde parei|repetir aula)\b/.test(normalized) && state.lastLearningTrack){
    selected = entries.find(([key]) => key === state.lastLearningTrack);
  }
  if(!selected) return null;
  const [key, track] = selected;
  if(!/\b(ensine|curso|aula|trilha|aprender|proxima|continuar|onde parei|repetir)\b/.test(normalized)) return null;
  state.learningProgress = state.learningProgress && typeof state.learningProgress === 'object' ? state.learningProgress : {};
  let index = Math.max(0, Math.min(track.lessons.length - 1, Number(state.learningProgress[key]) || 0));
  if(/\b(reiniciar|recomecar|comecar de novo)\b/.test(normalized)) index = 0;
  else if(/\b(proxima|continuar)\b/.test(normalized)) index = Math.min(track.lessons.length - 1, index + 1);
  state.learningProgress[key] = index;
  state.lastLearningTrack = key;
  const lesson = track.lessons[index];
  if(/\b(onde parei|progresso)\b/.test(normalized)) return {topic:'curso ' + key, reply:'O senhor está na aula ' + (index + 1) + ' de ' + track.lessons.length + ' da trilha ' + track.name + ': ' + lesson[0] + '.', detail:lesson[2]};
  return {topic:'curso ' + key, reply:'Trilha ' + track.name + ', aula ' + (index + 1) + ' de ' + track.lessons.length + ': ' + lesson[0] + '. ' + lesson[1] + ' Exercício: ' + lesson[2], detail:lesson[2]};
}

function programmingLessonReply(lesson, index){
  return 'Aula ' + (index + 1) + ' de ' + PROGRAMMING_COURSE.length + ': ' + lesson.title + '. ' + lesson.explanation + ' ' + lesson.example + ' Exercício: ' + lesson.exercise;
}

function answerProgrammingCourse(text, state){
  const normalized = normalizeKnowledge(text);
  const current = Math.max(0, Math.min(PROGRAMMING_COURSE.length - 1, Number(state.programmingLesson) || 0));
  if(state.pendingProgrammingQuiz != null && /^(resposta|respondo|minha resposta)\b/.test(normalized)){
    const quizIndex = Number(state.pendingProgrammingQuiz) % PROGRAMMING_QUIZZES.length;
    const quiz = PROGRAMMING_QUIZZES[quizIndex];
    const answerText = normalized.replace(/^(resposta|respondo|minha resposta)\s*/, '');
    const hits = quiz.keywords.filter(keyword => answerText.includes(normalizeKnowledge(keyword)));
    state.pendingProgrammingQuiz = null;
    state.programmingQuizScore = Number(state.programmingQuizScore || 0) + (hits.length ? 1 : 0);
    state.programmingQuizAnswered = Number(state.programmingQuizAnswered || 0) + 1;
    return {topic:'curso de programação', reply:(hits.length ? 'Correto, senhor. ' : 'Ainda não. ') + quiz.answer + ' Placar: ' + state.programmingQuizScore + ' de ' + state.programmingQuizAnswered + '.', detail:quiz.answer};
  }
  if(/\b(quiz de programacao|teste de programacao|teste meus conhecimentos|me teste sobre programacao)\b/.test(normalized)){
    const quizIndex = Number(state.programmingQuizIndex || 0) % PROGRAMMING_QUIZZES.length;
    const quiz = PROGRAMMING_QUIZZES[quizIndex];
    state.pendingProgrammingQuiz = quizIndex;
    state.programmingQuizIndex = quizIndex + 1;
    return {topic:'curso de programação', reply:'Pergunta ' + (quizIndex + 1) + ': ' + quiz.question + ' Responda começando com: resposta.', detail:quiz.answer};
  }
  const tracks = [
    {pattern:/\btrilha (de )?(fundamentos|iniciante|logica)\b/, title:'Lógica e algoritmos'},
    {pattern:/\btrilha (de )?(javascript|js)\b/, title:'JavaScript essencial'},
    {pattern:/\btrilha (de )?(web|frontend)\b/, title:'HTML e CSS'},
    {pattern:/\btrilha (de )?python\b/, title:'Python essencial'},
    {pattern:/\btrilha (de )?(backend|servidor)\b/, title:'Node.js e servidores'},
    {pattern:/\btrilha (de )?(dados|sql|banco de dados)\b/, title:'Modelagem relacional'},
    {pattern:/\btrilha (de )?(testes|qualidade)\b/, title:'Testes automatizados'},
    {pattern:/\btrilha (de )?(seguranca|security)\b/, title:'Segurança no código'},
    {pattern:/\btrilha (de )?(devops|infraestrutura)\b/, title:'Docker e contêineres'},
    {pattern:/\btrilha (de )?(avancado|arquitetura)\b/, title:'Arquitetura em camadas'},
    {pattern:/\btrilha (de )?(projetos|portfolio)\b/, title:'Projeto web completo'}
  ];
  const selectedTrack = tracks.find(track => track.pattern.test(normalized));
  if(selectedTrack){
    const index = PROGRAMMING_COURSE.findIndex(lesson => lesson.title === selectedTrack.title);
    if(index >= 0){
      state.programmingLesson = index;
      return {topic:'curso de programação', reply:'Trilha selecionada. ' + programmingLessonReply(PROGRAMMING_COURSE[index], index), detail:PROGRAMMING_COURSE[index].exercise};
    }
  }
  if(/\b(reiniciar|recomecar|comecar de novo)\b.*\b(programacao|curso|aula)\b/.test(normalized)){
    state.programmingLesson = 0;
    return {topic:'curso de programação', reply:programmingLessonReply(PROGRAMMING_COURSE[0], 0), detail:PROGRAMMING_COURSE[0].exercise};
  }
  if(/\b(me ensine programacao|quero aprender programacao|curso de programacao|aula de programacao|ensinar programacao)\b/.test(normalized)){
    state.programmingLesson = current;
    return {topic:'curso de programação', reply:programmingLessonReply(PROGRAMMING_COURSE[current], current), detail:PROGRAMMING_COURSE[current].exercise};
  }
  if(/\b(proxima aula|avancar aula|continuar curso|continuar programacao)\b/.test(normalized)){
    const next = Math.min(PROGRAMMING_COURSE.length - 1, current + 1);
    state.programmingLesson = next;
    if(next === current) return {topic:'curso de programação', reply:'O senhor concluiu as ' + PROGRAMMING_COURSE.length + ' aulas do curso básico. Recomendo iniciar o projeto prático e me pedir ajuda em cada etapa.', detail:PROGRAMMING_COURSE[current].exercise};
    return {topic:'curso de programação', reply:programmingLessonReply(PROGRAMMING_COURSE[next], next), detail:PROGRAMMING_COURSE[next].exercise};
  }
  if(/\b(repetir aula|repita a aula|aula atual)\b/.test(normalized)){
    return {topic:'curso de programação', reply:programmingLessonReply(PROGRAMMING_COURSE[current], current), detail:PROGRAMMING_COURSE[current].exercise};
  }
  if(/\b(exercicio de programacao|passe um exercicio|qual o exercicio)\b/.test(normalized)){
    return {topic:'curso de programação', reply:'Exercício da aula ' + (current + 1) + ': ' + PROGRAMMING_COURSE[current].exercise, detail:PROGRAMMING_COURSE[current].exercise};
  }
  if(/\b(onde parei|qual aula estou|progresso do curso)\b/.test(normalized)){
    return {topic:'curso de programação', reply:'O senhor está na aula ' + (current + 1) + ' de ' + PROGRAMMING_COURSE.length + ': ' + PROGRAMMING_COURSE[current].title + '.', detail:PROGRAMMING_COURSE[current].exercise};
  }
  return null;
}

function answerCountryQuestion(text){
  const found = findCountry(text);
  if(!found) return null;
  const country = found[1];
  const normalized = normalizeKnowledge(text);
  if(/\bcapital\b/.test(normalized)) return {topic:'geografia', reply:'A capital de ' + country.name + ' é ' + country.capital + '.'};
  if(/\b(moeda|dinheiro)\b/.test(normalized)) return {topic:'geografia', reply:'A moeda de ' + country.name + ' é ' + country.currency + '.'};
  if(/\b(idioma|lingua|linguagem)\b/.test(normalized)) return {topic:'geografia', reply:'Em ' + country.name + ', ' + country.language + ' é usado como idioma oficial ou predominante.'};
  if(/\b(continente|onde fica|localizado)\b/.test(normalized)) return {topic:'geografia', reply:country.name + ' fica em ' + country.continent + '.'};
  if(/\b(fale|conte|sobre|informacoes|resumo)\b/.test(normalized)){
    const government = country.government ? ' ' + country.government + '.' : '';
    return {topic:'geografia', reply:country.name + ' fica em ' + country.continent + ', tem capital em ' + country.capital + ', usa ' + country.currency + ' e tem ' + country.language + ' como idioma oficial ou predominante.' + government};
  }
  return null;
}

class MegaBrain {
  constructor(options = {}){
    this.file = options.file || brainDataPath();
    this.fetch = options.fetch || global.fetch;
    this.model = 'maia-local-knowledge';
    this.runtime = {warming:false, ready:false, lastWarmupAt:null, lastLatencyMs:null, error:null};
    this.state = {version:1, turns:[], memories:[], ...safeRead(this.file)};
  }

  persist(){
    fs.mkdirSync(path.dirname(this.file), {recursive:true});
    const temp = this.file + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(this.state, null, 2), "utf8");
    fs.renameSync(temp, this.file);
  }

  remember(text, source = "user"){
    const value = cleanText(text, 500);
    if(!value) return null;
    const normalized = value.toLocaleLowerCase("pt-BR");
    this.state.memories = this.state.memories.filter(item => item.normalized !== normalized);
    const item = {id:Date.now().toString(36), text:value, normalized, category:memoryCategory(value), source, createdAt:new Date().toISOString()};
    this.state.memories.unshift(item);
    this.state.memories = this.state.memories.slice(0, MAX_MEMORIES);
    this.persist();
    return item;
  }

  forget(query){
    const needle = cleanText(query, 200).toLocaleLowerCase("pt-BR");
    const before = this.state.memories.length;
    this.state.memories = this.state.memories.filter(item => !item.normalized.includes(needle));
    this.persist();
    return before - this.state.memories.length;
  }

  thinkLocally(input){
    const prompt = cleanText(input);
    if(!prompt) throw new Error('pedido vazio');
    const normalized = normalizeKnowledge(prompt);
    let reply = '';
    let topic = null;
    let memory = null;

    if(/\b(esta errado|resposta errada|voce errou|isso esta errado)\b/.test(normalized)){
      const previousQuestion = [...this.state.turns].reverse().find(turn => turn.role === 'user');
      this.state.awaitingCorrection = previousQuestion ? previousQuestion.content : null;
      reply = this.state.awaitingCorrection
        ? 'Entendido, senhor. Qual é a resposta correta? Diga: o correto é, seguido da informação.'
        : 'Entendido, senhor. Diga a informação correta começando com: aprenda que.';
      topic = 'correcao';
    }

    const correction = prompt.match(/^\s*(?:o correto (?:e|é)|a resposta correta (?:e|é))\s+(.+)/i);
    if(!reply && correction && this.state.awaitingCorrection){
      const correctedAnswer = cleanText(correction[1], 1000);
      this.state.corrections = Array.isArray(this.state.corrections) ? this.state.corrections : [];
      const questionKey = normalizeKnowledge(this.state.awaitingCorrection);
      this.state.corrections = this.state.corrections.filter(item => item.questionKey !== questionKey);
      this.state.corrections.unshift({question:this.state.awaitingCorrection, questionKey, answer:correctedAnswer, correctedAt:new Date().toISOString()});
      this.state.corrections = this.state.corrections.slice(0, 200);
      this.state.awaitingCorrection = null;
      reply = 'Correção registrada, senhor. A partir de agora usarei: ' + correctedAnswer + '.';
      topic = 'correcao';
    }

    const teaching = prompt.match(/^\s*(?:aprenda|lembre|memorize|guarde)\s+que\s+(.+)/i);
    if(teaching && teaching[1]){
      memory = cleanText(teaching[1], 500);
      this.remember(memory, 'explicit-local-teaching');
      reply = 'Entendido, senhor. Registrei que ' + memory.replace(/[.!?]+$/g, '') + '.';
      topic = 'memoria';
    }

    if(!reply && /^(oi|ola|bom dia|boa tarde|boa noite|e ai|maia)$/.test(normalized)){
      reply = 'Olá, senhor. Sistemas locais ativos; como posso ajudar?';
      topic = 'saudacao';
    }
    if(!reply && /\b(obrigado|valeu|agradeco)\b/.test(normalized)){
      reply = 'Sempre às ordens, senhor.';
      topic = 'cortesia';
    }
    if(!reply && /\b(como voce esta|tudo bem com voce|como vai)\b/.test(normalized)){
      reply = 'Estou operacional e pronto para ajudar, senhor.';
      topic = 'estado';
    }

    if(!reply && Array.isArray(this.state.corrections)){
      const learnedCorrection = this.state.corrections.find(item => item.questionKey === normalized || (normalized.length > 12 && editDistance(item.questionKey, normalized) <= 3));
      if(learnedCorrection){
        reply = learnedCorrection.answer;
        topic = 'correcao aprendida';
      }
    }

    if(!reply){
      const learning = answerLearningTrack(prompt, this.state);
      if(learning){
        reply = learning.reply;
        topic = learning.topic;
        this.state.lastExplanation = learning.detail;
      }
    }

    if(!reply){
      const course = answerProgrammingCourse(prompt, this.state);
      if(course){
        reply = course.reply;
        topic = course.topic;
        this.state.lastExplanation = course.detail;
      }
    }

    const wantsDetail = /^(explique melhor|detalhe|continue|quero saber mais|como assim|por que|porque)$/.test(normalized);
    if(!reply && wantsDetail && this.state.lastTopic){
      const previous = LOCAL_KNOWLEDGE.find(item => item.topic === this.state.lastTopic);
      if(previous){
        reply = previous.detail;
        topic = previous.topic;
      }else if(this.state.lastExplanation){
        reply = this.state.lastExplanation;
        topic = this.state.lastTopic;
      }
    }

    if(!reply){
      const knowledge = LOCAL_KNOWLEDGE.find(item => item.patterns.some(pattern => pattern.test(normalized)));
      if(knowledge){
        reply = /\b(explique|detalhe|como funciona|por que)\b/.test(normalized) ? knowledge.short + ' ' + knowledge.detail : knowledge.short;
        topic = knowledge.topic;
      }
    }

    if(!reply){
      const countryAnswer = answerCountryQuestion(prompt);
      if(countryAnswer){
        reply = countryAnswer.reply;
        topic = countryAnswer.topic;
        this.state.lastExplanation = 'Posso informar capital, moeda, idioma predominante e continente dos países cadastrados.';
      }
    }

    if(!reply){
      const packed = findPackedTopic(prompt);
      if(packed){
        reply = /\b(explique|detalhe|como funciona|por que|o que)\b/.test(normalized) ? packed.answer + ' ' + packed.detail : packed.answer;
        topic = packed.topic;
        this.state.lastExplanation = packed.detail;
      }
    }

    if(!reply && /\b(o que voce lembra|o que sabe sobre mim|minhas memorias|minha memoria)\b/.test(normalized)){
      const recent = this.state.memories.slice(0, 8).map(item => item.text);
      reply = recent.length ? 'Lembro destas informações: ' + recent.join('; ') + '.' : 'Ainda não tenho fatos pessoais registrados, senhor.';
      topic = 'memoria';
    }

    if(!reply && this.state.memories.length){
      const ignored = new Set(['qual','quais','como','porque','sobre','voce','sabe','lembra','diga','fale','para','isso','esta','meu','minha']);
      const queryTokens = normalized.split(' ').filter(token => token.length > 2 && !ignored.has(token));
      let best = null;
      let bestScore = 0;
      for(const item of this.state.memories){
        const memoryText = normalizeKnowledge(item.text);
        const score = queryTokens.filter(token => memoryText.includes(token)).length;
        if(score > bestScore){ best = item; bestScore = score; }
      }
      if(best && bestScore > 0 && /\b(lembra|sabe|qual|quem|prefer|gosto|minha|meu)\b/.test(normalized)){
        reply = 'Sim, senhor. Tenho registrado: ' + best.text + '.';
        topic = 'memoria';
      }
    }

    if(!reply){
      reply = 'Ainda não tenho uma resposta confiável para isso, senhor. O senhor pode me ensinar dizendo: aprenda que, seguido da informação.';
      topic = 'desconhecido';
    }

    this.state.lastTopic = topic;
    if(topic !== 'geografia' && !String(topic || '').startsWith('curso ') && !TOPICS.some(item => item.topic === topic)) this.state.lastExplanation = null;
    this.state.turns.push({role:'user', content:prompt}, {role:'assistant', content:reply});
    this.state.turns = this.state.turns.slice(-(MAX_TURNS * 2));
    this.persist();
    this.runtime.ready = true;
    this.runtime.error = null;
    this.runtime.lastLatencyMs = 0;
    return {reply, intent:'chat', steps:[], memory, model:'maia-local-knowledge', latencyMs:0};
  }

  async think(input, options = {}){
    return this.thinkLocally(input);
  }

  async warmup(){
    this.runtime.ready = true;
    this.runtime.error = null;
    this.runtime.lastWarmupAt = new Date().toISOString();
    return this.status();
  }

  validateResult(parsed, fallback){
    if(!parsed || typeof parsed !== "object"){
      return {reply:cleanText(fallback, 2000) || "Nao consegui estruturar a resposta.", intent:"chat", steps:[], memory:null};
    }
    const knownTools = new Map(TOOL_CATALOG.map(tool => [tool.name, tool]));
    const steps = Array.isArray(parsed.steps) ? parsed.steps.slice(0, 8).flatMap(step => {
      const tool = knownTools.get(step && step.tool);
      if(!tool) return [];
      return [{tool:tool.name, arguments:step.arguments && typeof step.arguments === "object" ? step.arguments : {}, risk:tool.risk, requiresConfirmation:tool.risk !== "low"}];
    }) : [];
    return {
      reply:cleanText(parsed.reply, 2000) || "Plano preparado.",
      intent:steps.length ? "plan" : "chat",
      steps,
      memory:parsed.memory ? cleanText(parsed.memory, 500) : null
    };
  }

  status(){
    return {model:'maia-local-knowledge', mode:'deterministic-local', memories:this.state.memories.length, turns:this.state.turns.length, knowledgeTopics:LOCAL_KNOWLEDGE.length + TOPICS.length, countries:Object.keys(COUNTRIES).length, learningTracks:Object.keys(LEARNING_TRACKS).length, learningLessons:Object.values(LEARNING_TRACKS).reduce((sum, track) => sum + track.lessons.length, 0), programmingLessons:PROGRAMMING_COURSE.length, programmingQuizzes:PROGRAMMING_QUIZZES.length, programmingLesson:(Number(this.state.programmingLesson) || 0) + 1, programmingQuizScore:Number(this.state.programmingQuizScore || 0), tools:TOOL_CATALOG.length, ...this.runtime};
  }
}

module.exports = {MegaBrain, TOOL_CATALOG, extractJson};
