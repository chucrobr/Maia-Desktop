# Ponte local da Maia

Esta ponte libera funções que um arquivo HTML comum não pode executar sozinho:

- abrir Spotify
- abrir busca no Spotify
- aumentar, diminuir ou silenciar o volume do Windows
- reproduzir, pausar, avançar e voltar músicas
- comandos do sistema
- telemetria
- noticias
- automacoes locais

Como usar:

1. Abra a Maia pelo executável ou com `npm start`.
2. Mantenha a Maia ativa ao usar funções do Windows, Spotify ou automações.
3. Durante o desenvolvimento, a interface principal fica em `src/ui/maia.html`.

Comandos de exemplo:

- abrir Spotify
- tocar Daft Punk no Spotify
- aumentar volume
- diminuir volume
- mutar
- pausar
- próxima música
- música anterior
- notícia do dia
- como está minha internet

Limite importante:

Reproduzir conteúdo específico no Spotify exige autenticação na API oficial.
Sem autorização, a ponte usa os recursos de mídia disponíveis no Windows.
