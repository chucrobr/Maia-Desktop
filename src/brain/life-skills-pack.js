const LEARNING_TRACKS = Object.freeze({
  ingles:{name:'Inglês', aliases:['ingles','english'], lessons:[
    ['Fundamentos','Pronomes pessoais, verbo to be e frases afirmativas formam a base.','Monte três frases: I am, you are e they are.'],
    ['Vocabulário cotidiano','Aprenda palavras dentro de frases e situações, não como listas isoladas.','Crie frases com work, home, time, food e help.'],
    ['Perguntas','Perguntas usam auxiliares e ordem própria: do, does, did, can e will.','Transforme you work here em uma pergunta.'],
    ['Tempos verbais','Presente descreve rotina, passado fatos concluídos e futuro planos ou previsões.','Conte ontem, hoje e amanhã em três frases.'],
    ['Conversação','Ouvir, repetir e responder com frases curtas desenvolve fluência funcional.','Simule uma apresentação com nome, cidade e profissão.'],
    ['Leitura e escrita','Leia textos curtos, destaque estruturas e escreva um resumo simples.','Resuma em inglês uma notícia curta em duas frases.']
  ]},
  matematica:{name:'Matemática', aliases:['matematica','algebra','geometria'], lessons:[
    ['Aritmética','Operações, frações, decimais e porcentagens sustentam cálculos cotidianos.','Calcule quinze por cento de duzentos.'],
    ['Álgebra','Álgebra usa símbolos para representar valores e relações desconhecidas.','Resolva dois x mais quatro igual a doze.'],
    ['Geometria','Perímetro mede contorno, área mede superfície e volume mede espaço ocupado.','Calcule a área de um retângulo de cinco por oito.'],
    ['Funções','Função relaciona entradas a saídas segundo uma regra.','Calcule f de três quando f de x é dois x mais um.'],
    ['Estatística','Média, mediana, dispersão e gráficos ajudam a interpretar dados.','Compare média e mediana do conjunto dois, três, quatro e vinte.'],
    ['Probabilidade','Probabilidade mede incerteza usando resultados possíveis e favoráveis.','Qual a chance de tirar número par em um dado justo?']
  ]},
  informatica:{name:'Informática e diagnóstico', aliases:['informatica','windows','computador','hardware'], lessons:[
    ['Hardware','CPU processa, RAM mantém trabalho temporário, SSD armazena e GPU processa gráficos.','Explique qual componente afeta muitos programas abertos.'],
    ['Windows','Processos, serviços, arquivos, permissões e atualizações mantêm o sistema funcionando.','Abra o Gerenciador de Tarefas e identifique consumo de CPU e RAM.'],
    ['Redes','IP identifica interfaces, DNS resolve nomes e roteadores encaminham pacotes.','Diferencie falha de Wi-Fi, DNS e internet.'],
    ['Diagnóstico','Reproduza, observe mensagem, isole mudança recente e teste uma hipótese por vez.','Monte um diagnóstico para programa que não abre.'],
    ['Manutenção','Atualizações, espaço livre, backups e inicialização controlada evitam muitos problemas.','Liste três verificações mensais do computador.'],
    ['Desempenho','Meça CPU, RAM, disco, temperatura e latência antes de tentar otimizar.','Identifique o provável gargalo quando disco fica em cem por cento.']
  ]},
  financas:{name:'Finanças pessoais', aliases:['financas','dinheiro','orcamento'], lessons:[
    ['Orçamento','Registre renda e gastos, separe essenciais, variáveis e objetivos.','Monte categorias para um orçamento mensal.'],
    ['Reserva','Reserva de emergência reduz dependência de crédito diante de imprevistos.','Estime quantos meses de despesas deseja proteger.'],
    ['Dívidas','Compare custo efetivo, priorize juros altos e evite novas parcelas sem espaço.','Ordene dívidas por taxa e risco.'],
    ['Juros','Juros compostos fazem valores crescerem sobre principal e rendimentos acumulados.','Compare pagar mínimo e quitar uma fatura.'],
    ['Investimentos','Prazo, liquidez, risco, diversificação e custos devem orientar escolhas.','Defina objetivo, prazo e tolerância a risco antes do produto.'],
    ['Proteção contra golpes','Urgência, promessa garantida e pedido de senha são sinais de alerta.','Liste verificações antes de transferir dinheiro.']
  ]},
  seguranca:{name:'Segurança digital', aliases:['seguranca digital','ciberseguranca','privacidade'], lessons:[
    ['Contas','Use senhas únicas, gerenciador e autenticação em dois fatores.','Revise quais contas críticas ainda repetem senha.'],
    ['Phishing','Confirme domínio, remetente e pedido por outro canal antes de agir.','Identifique três sinais de mensagem falsa.'],
    ['Dispositivos','Atualize sistema, bloqueie tela, limite permissões e mantenha backup.','Faça uma lista de proteção para celular perdido.'],
    ['Privacidade','Colete e compartilhe apenas o necessário; revise permissões e rastreamento.','Escolha aplicativos que não precisam de localização.'],
    ['Navegação segura','HTTPS protege trânsito, mas não garante honestidade do site.','Verifique endereço e reputação antes de login.'],
    ['Resposta a incidente','Isole, preserve evidências, troque credenciais em dispositivo seguro e monitore contas.','Descreva ações após suspeita de invasão.']
  ]},
  portugues:{name:'Português e redação', aliases:['portugues','gramatica','redacao'], lessons:[
    ['Classes de palavras','Substantivos nomeiam, verbos expressam processos e adjetivos caracterizam.','Classifique as palavras de uma frase curta.'],
    ['Concordância','Elementos relacionados devem concordar em número, pessoa e gênero quando aplicável.','Corrija: as informação chegou.'],
    ['Pontuação','Pontuação organiza relações e ritmo; vírgula não deve separar sujeito do verbo.','Pontue uma enumeração e uma explicação.'],
    ['Coesão','Conectivos e referências ligam ideias sem repetição excessiva.','Una duas frases usando portanto ou porém.'],
    ['Argumentação','Uma tese clara precisa de razões, evidências e consideração de objeções.','Escreva tese e dois argumentos sobre estudo online.'],
    ['Revisão','Revise conteúdo, estrutura, clareza e norma em etapas separadas.','Reduza uma frase longa sem perder significado.']
  ]},
  negocios:{name:'Empreendedorismo e vendas', aliases:['empreendedorismo','negocios','vendas','marketing'], lessons:[
    ['Problema e cliente','Negócio começa por problema relevante de um público específico.','Descreva cliente, problema e alternativa atual.'],
    ['Proposta de valor','Explique resultado, público e diferença sem frases vagas.','Crie uma proposta de valor em uma sentença.'],
    ['Validação','Converse com clientes e teste comportamento antes de investir pesado.','Prepare cinco perguntas sem induzir respostas.'],
    ['Vendas','Diagnostique necessidade, demonstre valor e trate objeções com honestidade.','Monte perguntas para uma conversa de venda.'],
    ['Marketing','Escolha canal, mensagem, oferta e métrica de acordo com o público.','Defina uma campanha com objetivo mensurável.'],
    ['Métricas','Acompanhe receita, margem, conversão, retenção, aquisição e caixa.','Escolha três métricas para uma loja online.']
  ]},
  socorros:{name:'Primeiros socorros básicos', aliases:['primeiros socorros','emergencia'], lessons:[
    ['Segurança e ajuda','Proteja o local, avalie resposta e acione ajuda; no Brasil, SAMU 192 e Bombeiros 193.','Memorize localização e informações para a chamada.'],
    ['Consciência e respiração','Pessoa inconsciente ou com respiração anormal exige emergência imediata e orientação do atendente.','Descreva o que informar ao serviço de emergência.'],
    ['Sangramento','Pressão direta com material limpo ajuda a controlar sangramento; não retire objeto encravado.','Explique quando acionar emergência.'],
    ['Queimaduras','Afaste a fonte e resfrie com água corrente; não use gelo, pasta ou receitas caseiras.','Liste práticas que devem ser evitadas.'],
    ['Engasgo','Se a pessoa não consegue respirar ou falar, acione emergência e siga orientação adequada à idade.','Diferencie tosse eficaz de obstrução grave.'],
    ['Limites','Treinamento presencial é essencial; o Maia não substitui profissional ou serviço de emergência.','Identifique situações que exigem ajuda imediata.']
  ]},
  estudos:{name:'Métodos de estudo', aliases:['estudos','aprender','memorizacao'], lessons:[
    ['Objetivos','Transforme meta ampla em resultados observáveis e sessões pequenas.','Defina o resultado de uma sessão de vinte e cinco minutos.'],
    ['Recuperação ativa','Tente recordar sem olhar; o esforço de recuperação fortalece aprendizagem.','Crie cinco perguntas sobre o tema estudado.'],
    ['Revisão espaçada','Revise em intervalos crescentes antes de esquecer completamente.','Planeje revisões em um, três, sete e quatorze dias.'],
    ['Prática deliberada','Trabalhe a dificuldade específica com feedback rápido e repetição consciente.','Escolha uma fraqueza e uma forma objetiva de medir melhora.'],
    ['Intercalação','Misture tipos relacionados de problema para aprender a escolher estratégias.','Alterne álgebra, porcentagem e geometria numa sessão.'],
    ['Sono e consistência','Sono consolida memória; frequência sustentável supera maratonas ocasionais.','Monte uma rotina semanal realista.']
  ]}
});

module.exports = {LEARNING_TRACKS};
