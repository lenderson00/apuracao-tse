# Dados detalhados da apuração

A busca aceita nomes sem acento e números de candidatos, além dos municípios. Presidente usa o cadastro do Brasil; governador e senador usam as UFs já carregadas; deputados usam a UF em foco. A lista de candidatos da busca exibe até oito resultados.

O modo candidato reaproveita as linhas dos arquivos que o mapa já baixa. A escala indica o percentual dos votos válidos, com degraus em 20%, 35%, 50% e 65%. Os rankings e a contagem de lideranças consideram as regiões com dados carregados e se atualizam progressivamente.

Zonas só carregam ao abrir a aba, com limite global de seis requisições simultâneas, inclusive no Strict Mode. Seções só carregam ao abrir o bloco correspondente. O índice é compartilhado por UF e turno pela camada existente. O boletim filtra eleição e cargo e associa os nomes pelo número. Ausências de publicação e falhas de decodificação têm estados próprios.

## Verificação

Com `npm run dev` rodando:

```sh
npm run build
npm run lint
npm run test:parse
npx tsx scripts/check-urna.ts
node scripts/screenshots-v6.mjs
```

As dez capturas de desktop (1440×900) e mobile (390×844) ficam em `/workspace/apuracao-shots/v6/`. O script percorre busca, país, UF, zonas de São Paulo e boletim. Também verifica carregamento sob demanda, concorrência máxima, link original, erros do navegador e ausência de scroll da página.

Foram exercitados adicionalmente o detalhe direto de Porto Walter (uma zona), a resposta 404 do auxiliar e um arquivo de boletim inválido, usando interceptação de rede apenas para os dois casos de erro. As capturas usam arquivos reais do primeiro turno. A busca por número de governador foi conferida com foco automático na Bahia, seguida da busca de deputados restrita à UF e limitada a oito opções.

O lint permanece com os dez avisos já existentes sobre efeitos React e uma importação não utilizada. Resultados dependem da publicação e disponibilidade do TSE; rankings parciais são identificados como dados carregados.
