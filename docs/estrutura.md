# Estrutura do projeto

- `assets/`: ícones e recursos visuais usados pelo instalador.
- `docs/`: documentação de desenvolvimento e integrações.
- `releases/`: instalador atual pronto para distribuição.
- `scripts/`: validações e ferramentas de manutenção.
- `src/main/`: processo principal do Electron e janelas.
- `src/preload/`: ponte segura do botão flutuante.
- `src/ui/`: interface principal e botão flutuante.
- `src/bridge/`: integrações locais com Windows e Spotify.
- `src/brain/`: conhecimento, personalidade e interpretação local.
- `src/config/`: comandos e atualização.
- `dist/`: saída temporária gerada pelo empacotamento.

## Regras

- Código-fonte fica somente em `src/`.
- Recursos usados em produção ficam em `assets/`.
- Arquivos gerados não devem ser editados manualmente.
- Apenas o instalador atual deve permanecer em `releases/`.
- Caches, logs e versões antigas não fazem parte do projeto.
- Execute `npm run check` antes de testar ou distribuir alterações.
- Toda alteração distribuída deve incrementar a versão, atualizar
  `docs/CHANGELOG.md`, refletir novidades na Central de Extensões, gerar um novo
  instalador e substituir o instalador oficial em `releases/`.
