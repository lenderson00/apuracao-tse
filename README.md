# Apuração 2026 (TSE)

Site em pt-BR para acompanhar a apuração das Eleições Gerais 2026 com dados públicos do Tribunal Superior Eleitoral.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS 4, GSAP, D3 (mapas SVG)
- GeoJSON: estados (Click That Hood) e municípios por UF ([geodata-br](https://github.com/tbrugz/geodata-br))

## Dados oficiais (TSE)

| Recurso | URL |
|--------|-----|
| Configuração de eleições | `https://resultados.tse.jus.br/oficial/comum/config/ele-c.json` |
| Presidente 2º turno (BR) | `.../oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json` |
| Presidente 1º turno (BR) | `.../6257/dados/br/br-c0001-e006257-u.json` |
| Por UF (ex.: SP) | `.../6258/dados/sp/sp-c0001-e006258-u.json` |
| Por município (ex.: São Paulo/SP) | `.../6258/dados/sp/sp71072-c0001-e006258-u.json` |
| Governador 2º turno (UF) | eleição `6260`, cargo `0003` |
| Estadual 1º turno | eleição `6259` (gov, senado, deputados) |
| Índice de municípios | `.../oficial/ele2026/{ele}/config/mun-e{ele}-u.json` → `mun-e006258-cm.json` |
| Fotos de candidatos | `.../oficial/ele2026/{ele}/fotos/{uf}/{sqcand}.jpeg` |

Padrão do arquivo unificado (EA20):

`/oficial/ele2026/<cd_eleicao>/dados/<pasta>/<pasta>-c<cargo>-e<cd_eleicao>-u.json`

Códigos 2026: 1º turno federal `6257`, estadual `6259`; 2º turno federal `6258`, estadual `6260`.

## CORS e proxy

O CDN do TSE **não** envia `Access-Control-Allow-Origin`. O app chama sempre `/api/tse/...`, que é encaminhado para `resultados.tse.jus.br`:

- **Desenvolvimento:** proxy no `vite.config.ts`
- **Produção local:** `npm run build && npm start` (`server.mjs` serve `dist/` + proxy)
- **Hospedagem estática:** configure o mesmo rewrite (ex.: Netlify/Cloudflare `_redirects` ou nginx `proxy_pass`)

Sem proxy, o navegador bloqueia o fetch; não há números inventados — a UI mostra erro ou estado vazio.

## Limitações

- Apuração municipal no mapa dispara muitas requisições (uma por município); há carregamento em lotes e barra de progresso.
- Governador no 2º turno só existe nas UFs com segundo turno (AC, AM, DF, ES, RN, TO em 2026).
- Senado e deputados só no 1º turno (`6259`).
- Enquanto o TSE não totaliza, `st` dos candidatos pode vir vazio e votos zerados — comportamento esperado antes das 17h ou no início da contagem.

## Comandos

```bash
npm install
npm run geo:download   # municípios GeoJSON (já incluídos em public/geo/mun/)
npm run dev            # http://127.0.0.1:4321
npm run build
npm start              # build + proxy estático
```

## Fixtures (somente desenvolvimento)

Não incluídos no build de produção. Para testar offline, você pode apontar o proxy para arquivos locais em `public/fixtures/` (não versionados por padrão).
