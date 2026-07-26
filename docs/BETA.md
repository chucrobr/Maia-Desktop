# Maia Desktop — informações da beta

## Objetivo desta fase

A beta existe para testar estabilidade, instalação, compatibilidade com computadores diferentes e funcionamento das integrações antes de uma versão estável.

## Limitações conhecidas

- Reconhecimento de voz depende dos recursos disponíveis no Windows ou navegador.
- Voz no Maia Connect exige uma origem HTTPS compatível; no iPhone o controle permanece por texto.
- Home Assistant exige endereço acessível e token de longa duração.
- Trânsito ao vivo exige uma chave válida da Google Routes com faturamento configurado na conta Google.
- Spotify pode exigir login e autorização próprios.
- Desempenho visual varia conforme processador, memória e GPU.
- Acesso ao Maia Connect deve permanecer em rede local confiável.

## Dados e privacidade

- Preferências e memória são salvas no computador.
- Credenciais de integrações são configuradas individualmente e não acompanham o instalador.
- O desinstalador preserva dados locais para permitir atualização sem perda de configuração.
- Ações sensíveis continuam exigindo confirmação.

## Antes de publicar uma atualização

1. Atualizar a versão do pacote.
2. Atualizar a Central e o changelog.
3. Executar `npm run check`.
4. Executar `npm run test:connect`.
5. Gerar o instalador com `npm run dist`.
6. Instalar e abrir a versão gerada.
7. Conferir se nenhum token ou arquivo pessoal entrou no pacote.
8. Publicar notas de versão usando o modelo de release.

## Publicação no GitHub

O instalador ultrapassa o limite recomendado para arquivos comuns do repositório. Não envie o `.exe` dentro de um commit.

Crie uma release para a tag da versão e anexe `Maia-Setup-<versão>.exe` como arquivo da release. O diretório `releases` está ignorado pelo Git para evitar commits acidentais do binário.
