# Maia Desktop

Maia é uma assistente pessoal para Windows criada por **clchucro**. O projeto reúne comandos de voz e texto, automações locais, controle de mídia, integração com serviços e acesso pelo celular.

> Esta versão é beta. Alguns recursos dependem do Windows, da rede local ou de serviços externos e podem exigir configuração manual.

## O que já funciona

- comandos de voz e texto;
- abertura de programas e controles do Windows;
- Spotify, YouTube e serviços de streaming;
- alarmes, lembretes, rotinas e memória local;
- 61 temas sincronizados com o núcleo flutuante;
- Maia Connect para controle pelo celular na mesma rede;
- Home Assistant por token de acesso de longa duração;
- clima de sete dias pela Open-Meteo;
- rotas com trânsito pela Google Routes;
- notificações de vendas por integração Arkama/Netlify;
- perfis visuais para desempenho e GPUs antigas.

## Requisitos

- Windows 10 ou 11 de 64 bits;
- conexão com a internet para integrações externas;
- Node.js LTS e npm somente para desenvolvimento.

## Instalação da beta

1. Baixe o instalador mais recente em `releases`.
2. Execute `Maia-Setup-<versão>.exe`.
3. O instalador cria atalhos no Menu Iniciar e na Área de Trabalho.
4. Configure apenas as integrações que pretende usar.

O Windows pode exibir um aviso por se tratar de uma beta distribuída fora da Microsoft Store. Confira o nome e a origem do arquivo antes de continuar.

## Desenvolvimento

```powershell
npm install
npm start
```

Validação:

```powershell
npm run check
npm run test:connect
```

Gerar instalador:

```powershell
npm run dist
```

O pacote é criado em `dist`. A versão aprovada para distribuição fica em `releases`.

## Configurações privadas

Tokens, chaves e contas pessoais não fazem parte do instalador. Arquivos `.env`, logs, cache e configurações locais estão ignorados pelo Git.

Nunca publique:

- token do Home Assistant;
- chave do Google Routes;
- `MAIA_DEVICE_TOKEN` da integração Netlify;
- tokens de Spotify ou outros serviços;
- conteúdo da pasta de dados pessoais `.maia`.

## Relatar problemas

Ao abrir um bug, informe:

- versão da Maia;
- versão do Windows;
- passos para reproduzir;
- comportamento esperado e observado;
- mensagem de erro sem tokens ou dados pessoais.

Use os modelos disponíveis na aba **Issues** do GitHub.

## Estado do projeto

A Maia está em desenvolvimento ativo. Recursos marcados como beta podem mudar entre versões. Consulte [docs/CHANGELOG.md](docs/CHANGELOG.md) para alterações e [docs/BETA.md](docs/BETA.md) para limitações conhecidas.

## Autoria

Desenvolvido por **clchucro**.

Instagram: [@clchucro](https://www.instagram.com/clchucro/)

## Licença

Todos os direitos reservados. Consulte [LICENSE](LICENSE).
