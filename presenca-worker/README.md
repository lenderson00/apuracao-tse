# apuracao-presenca

Contador "N acompanhando agora" do apuracao.lenderson.com.br. Cloudflare Worker + 1 Durable Object (SQLite), plano Workers Free.

- `POST /pulso` (corpo `id,u`, text/plain, só de origens permitidas): pulso de uma aba sorteada.
- `GET /agora` → CSV `n,exato,p,t,on,i`. O site lê por `/api/presenca/agora.csv` (rewrite cacheado na Vercel; `.csv` também é cacheado por padrão na Cloudflare), então a leitura não cresce com a audiência.

Amostragem: cada aba tem `u` fixo em [0,1) e só pulsa (a cada ~60 s, com a aba visível) se `u < p`. O DO ajusta `p` para manter ~`ALVO_AMOSTRA` abas na amostra e estima `n = amostra / p`. Com `p = 1` a contagem é exata; abaixo disso o site mostra "~12 mil".

Custo: ~ALVO_AMOSTRA pulsos/min, independente da audiência. `ORCAMENTO_DIA` corta tudo (o site esconde o contador) até 00:00 UTC (21:00 em Brasília).

Desligar: `ATIVO = "0"` em `wrangler.jsonc` e `npx wrangler deploy`. Teste de carga: `node teste-carga.mjs 500 5` (exige `MAX_POR_IP` alto, porque sai tudo de um IP).
