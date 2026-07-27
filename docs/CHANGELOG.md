# Novidades da Maia

## 5.3.0-beta.5 — Horizon final

- Migração concluída para a Horizon como interface principal e única.
- Identidade “Núcleo Online” removida das janelas e páginas.
- Preferências locais inválidas deixam de impedir a inicialização e são recuperadas com valores seguros.
- Palavras de ativação personalizadas passam a ser preservadas entre reinicializações.
- Seleção e velocidade de voz da Central agora controlam a fala real da Maia.
- Dependência Three.js removida do pacote; a Horizon não carrega motor 3D.
- Versão, novidades, Central e documentação da beta sincronizadas.

## 5.3.0-beta.4 — Horizon

- Horizon promovida a interface principal e única da Maia.
- Motor 3D clássico desativado para reduzir o uso de GPU em computadores antigos.
- Comandos, perguntas, telemetria e dispositivos de rede conectados ao motor real da Maia.
- Central reorganizada na Horizon com desempenho, integrações, Connect, automações, dados, segurança e extensões.
- Interface demonstrativa externa removida e substituída por comunicação local protegida.

## 5.3.0-beta.3 — Interface modular

- Interface principal dividida em HTML, CSS, renderização visual e lógica do aplicativo.
- Estrutura visual e comportamento preservados sem alteração das integrações existentes.
- Verificador do projeto atualizado para validar todos os módulos da interface.
- Inicialização real, Maia Connect e revisão de publicação testados após a separação.

## 5.3.0-beta.2 — Estabilidade e desempenho

- Renderização principal limitada a 60 FPS nos perfis Desempenho e GPU antiga.
- Redução automática para 30 FPS quando a interface fica realmente ociosa, voltando imediatamente após atividade.
- Botão flutuante pausa a animação e a captura de áudio quando está oculto.
- Relógios e lembretes usam agendamento adaptativo em vez de consulta a cada segundo.
- Recuperação do renderizador recebeu proteção contra ciclos de falha e recarga.
- Consulta de vendas Arkama/Netlify continua ativa quando configurada e deixa de criar temporizador sem configuração.
- Inicialização, Maia Connect e verificações de publicação testadas antes da geração do instalador.

## 5.3.0-beta.1 — Preparação da beta pública

- Autoria do projeto atualizada para clchucro no aplicativo, instalador e documentação.
- README refeito com instalação, recursos disponíveis, desenvolvimento e cuidados com credenciais.
- Documentadas as limitações conhecidas da beta e o processo usado antes de cada publicação.
- Adicionados modelos do GitHub para bugs, sugestões, pull requests e notas de versão.
- Criadas orientações de segurança e contribuição.
- Adicionada verificação pré-publicação para versão, autoria, documentação e arquivos privados.
- Textos de novidades revisados para registrar apenas alterações entregues e testáveis.

## 5.2.1 — Central organizada e GPU antiga

- Central da Maia dividida em Início, Integrações, Automação, Visual, Dados e Sistema.
- Apenas a categoria selecionada permanece aberta, reduzindo altura e intensidade visual.
- Camada da Central elevada, isolada e tornada opaca para impedir o núcleo 3D de aparecer sobre o menu.
- Modo Desempenho equilibrado criado com teto de 120 FPS e qualidade balanceada.
- Desempenho máximo dedicado a GPUs antigas, com teto firme de 60 FPS e perfil econômico.
- Migração automática do perfil anterior para o modo de GPU antiga.
- Intel HD Graphics 2500 indicada diretamente na descrição do perfil.

## 5.2.0 — Casa, clima e mobilidade

- Integração completa com a API REST oficial do Home Assistant.
- Configuração testada antes de salvar e token mantido fora do instalador.
- Descoberta de luzes, tomadas, cenas, automações, climatização, ventiladores, persianas, fechaduras, mídia e sensores.
- Painel para consultar estados e executar somente ações permitidas.
- Comandos naturais para ligar, desligar, abrir, fechar e executar cenas.
- Clima completo pela Open-Meteo: condições atuais, sensação, umidade, vento, rajadas e sete dias.
- Trânsito ao vivo e rotas alternativas pela Google Routes, usando chave pessoal opcional.
- Preferências locais de cidade e origem, testes de conexão, timeout e mensagens específicas de erro.

## 5.1.3 — Maia Connect em tamanho natural

- Escala automática 0,50× removida do iPhone 7.
- Interface móvel restaurada para 1×, com textos, cartões e botões maiores.
- Bloqueios de zoom por gesto, toque duplo e foco continuam ativos.
- Ajustes compactos para telas estreitas foram preservados.

## 5.1.2 — Voz móvel inteligente

- Comandos por texto mantidos como padrão no iPhone.
- Botão de microfone ocultado automaticamente em iPhones.
- Voz exibida no Android somente em contexto seguro e com APIs compatíveis.
- Solicitação explícita da permissão de microfone antes do reconhecimento.
- Bloqueios e incompatibilidades não interrompem mais o uso por texto.
- Mensagens de erro específicas e remoção automática do botão indisponível.
- Touchpad, teclado remoto e controles de apresentação removidos para simplificar o painel.
- Identidade visual padrão do Maia Connect alterada para o roxo luminoso do ícone da Maia.

## 5.1.1 — Modo iPhone 7

- Detecção automática de iPhone com tela de até 375 × 667 pontos.
- Escala 0,50× aplicada e travada automaticamente nesses aparelhos.
- Bloqueio de zoom por gesto, toque duplo e foco em campos.
- Campos mantidos em 16 px para impedir ampliação automática do Safari.
- Barra inferior ocultada enquanto o teclado virtual está aberto.
- Layout compacto adicional para telas estreitas.

## 5.1.0 — Maia Connect 2

- QR Code gerado localmente, sem serviços externos.
- Instalação na Tela de Início do iPhone com ícone e modo standalone.
- Código de convidado limitado a controles de mídia.
- Gerenciamento e revogação de celulares, histórico e limite de comandos.
- Rotinas predefinidas e personalizadas.
- Alarmes, lembretes e temporizadores integrados ao serviço do Windows.
- Seleção dos 61 temas na interface principal e no núcleo flutuante.
- Área de transferência compartilhada com confirmação de leitura.
- Envio de arquivos de até 180 KB e download de até 10 MB.
- Comandos por voz conforme suporte do navegador.
- Touchpad, teclado remoto e controles de apresentação.
- Suspensão e captura de tela protegidas por confirmação explícita.
- Controles avançados do Spotify e capas no painel móvel.
- Orientações seguras para iPhone, HTTPS e acesso por VPN pessoal.

## 5.0.0 — Maia Connect

- Painel móvel completo e responsivo servido diretamente pela Maia.
- Ativação manual e servidor separado da ponte interna.
- Código de pareamento temporário e token individual por celular.
- Telemetria de CPU, RAM e saúde do computador.
- Controles de mídia, Spotify, YouTube, streaming e volume.
- Abertura de aplicativos, bloqueio do computador, rede e downloads.
- Campo de comandos naturais com atalhos móveis.
- Desconexão individual e bloqueio de ações perigosas no acesso móvel.
- Extensão Maia Connect adicionada à Central.

## 4.3.2 — Temas no núcleo flutuante

- Todos os 61 temas agora são aceitos e persistidos pelo núcleo flutuante.
- As 38 novas paletas alteram núcleo, halo, partículas e realces.
- Os 10 novos exclusivos possuem efeitos próprios na janela flutuante.
- A tonalidade das partículas agora é derivada automaticamente da paleta ativa.

## 4.3.1 — Controle de FPS

- Desempenho Máximo limitado a 60 FPS para reduzir carga e instabilidade em
  GPUs integradas.
- Modo normal com teto de até 240 FPS, respeitando a frequência do monitor e o
  agendamento do Chromium.
- Extensão Temas e Efeitos atualizada para a versão 2.1.0.

## 4.3.0 — Coleção de temas

- 38 novos temas, totalizando 61 opções visuais.
- 10 novos temas exclusivos com animações próprias.
- Paletas individuais para núcleo, luz, realce, painéis e fundo.
- Novas categorias Natureza Elemental, Cosmos Profundo e Retro Digital.
- Novos temas também distribuídos entre Universo Futurista, Luxo Atemporal e
  Aura & Encanto.
- Nova extensão Temas e Efeitos visível na Central.

## 4.2.1 — Extensões e desempenho

- Extensões disponíveis renderizadas imediatamente ao abrir a Central.
- Catálogo local de segurança quando a ponte do Windows ainda está iniciando.
- Atualização do catálogo oficial continua acontecendo em segundo plano.
- Modo Desempenho Máximo com 76% menos partículas, resolução interna menor,
  efeitos secundários reduzidos e cálculos visuais intercalados.

## 4.2.0 — Central de Extensões

- Novo catálogo visual de extensões.
- Busca por nome, recurso, permissão ou comando.
- Filtros para extensões ativas, desativadas, novas e atualizadas.
- Indicadores de estado, versão e novidade.
- Visualização de comandos, permissões e histórico de cada extensão.
- Nova extensão oficial Rotinas Inteligentes.

## Regra de publicação

Toda alteração distribuída deve atualizar a versão, este histórico, o catálogo
de extensões afetado e o instalador oficial em `releases`.
