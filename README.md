# hybrid-run

App pessoal de treino híbrido (corrida + musculação). Este repositório começa pelo **motor de planejamento** (`src/lib/planner`): TypeScript puro, sem banco, sem rede, 100% testável.

## Rodar

Requer Node 20+.

```bash
npm install
npm test            # motor + gerador de plano
npm run typecheck
cp .env.example .env.local   # preencha (ver abaixo)
npm run dev         # http://localhost:3000
```

## Configuração (uma vez)

1. **Supabase:** crie um projeto → SQL Editor → cole `supabase/migrations/0001_init.sql` e execute. Em *Project Settings → API* copie a URL e a `service_role` key para `.env.local` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). A chave nunca vai para o navegador; o RLS fica ligado sem policies.
2. **Segredos locais:** `APP_PIN` (6–8 dígitos), `SESSION_SECRET` e `ENCRYPTION_KEY` (`openssl rand -hex 32`), `STRAVA_VERIFY_TOKEN` (texto livre).
3. **Strava:** em strava.com/settings/api crie o app. *Authorization Callback Domain* = domínio do site (`localhost` para testar). Copie Client ID/Secret para `.env.local`. Em *Perfil → Conectar Strava* o app pede `activity:read_all`.
4. **Webhook da Strava** (só funciona com o site publicado em HTTPS, não em localhost):
   ```bash
   curl -X POST https://www.strava.com/api/v3/push_subscriptions      -F client_id=ID -F client_secret=SECRET      -F callback_url=https://SEU-SITE/api/strava/webhook -F verify_token=SEU_STRAVA_VERIFY_TOKEN
   ```
5. **Deploy (Vercel):** importe o repositório do GitHub e cadastre as mesmas variáveis (`APP_URL` = URL do site, sem barra no final). **`APP_PIN` e `SESSION_SECRET` são obrigatórios.** Depois, mudou variável: Redeploy.
6. **iPhone:** no Safari, Compartilhar → Adicionar à Tela de Início (manifesto e ícones em `public/` e `src/app/`).

## O site

Layout "Hybrid Run — MVP" (tema claro, laranja de destaque, Barlow Condensed + Inter servidas localmente). Telas: **Hoje** (treino do dia com passos e ritmos, semana, "fiz"/"não deu", avaliação do feito) · **Calendário** (faixa de fases, tipos por dia, treino planejado × feito com voltas do Strava) · **Provas** · **Perfil** (treinos por semana, dias de descanso, recordes de qualquer distância, Strava) · **Saúde** (afastamento/dor com parte do corpo; a proposta mostra o que muda antes de gravar).

O plano é calculado na hora (`src/lib/plan.ts`) a partir da prova A (ou, sem prova, em modo evolução), dos recordes, do que você já corre no Strava e dos eventos de saúde. O treinador (`src/lib/planner/coach.ts`) varia longão, tiros e academia de semana em semana. O PIN é obrigatório em produção: sem `APP_PIN`/`SESSION_SECRET` o servidor responde 503 (só em `npm run dev` o app abre sem senha).

## O que já existe (v0.1 — motor, parte 1)

| Módulo | O que faz |
|---|---|
| `dates.ts` | Datas como `YYYY-MM-DD`; dia da semana **derivado** da data (nunca digitado) |
| `config.ts` | Parâmetros ajustáveis do motor |
| `paces.ts` | Riegel, pace de referência (melhor 5 km projetado), zonas de ritmo, avaliação de meta (realista / ambiciosa / inviável) |
| `phases.ts` | Periodização: base → velocidade → pico → taper, por distância e semanas disponíveis |
| `rules.ts` | Validador das regras duras R0–R8 (perna × corrida forte, dias seguidos fortes, descanso fixo, prova, tempo disponível, saúde) |
| `schedule.ts` | Agendador de **uma semana**: respeita as regras, reduz o volume quando necessário, descarta com motivo, backtracking |
| `exercises.ts` / `gym.ts` | Biblioteca de exercícios com filtro "só máquina, sem unilateral/equilíbrio", blocos 1–3 e progressão de carga |

Os testes reproduzem cenários reais: futebol no sábado (longão descartado), perna na terça + tiro na quinta (violação), tiro que não cabe na quinta (vai reduzido para a sexta), 5 km em 8 semanas (3+3+1+1), meta 22:30 depois de 9 dias parado (inviável).

## O que ainda NÃO existe

- Registro de cargas da academia (o treino varia e é avaliado por frequência, duração e FC, mas não por carga).
- Dias disponíveis por dia da semana além do descanso, eventos externos (futebol) editáveis.
- Planos versionados com histórico (a proposta compara o plano com e sem o evento, sem guardar versões).
- Webhook do Strava em tempo real (precisa do site publicado); localmente a sincronização roda ao abrir o app, no máximo a cada 15 min.
- Modo offline (o app abre em tela cheia pelo iPhone, mas precisa de internet).

## Segurança

Nunca versionar `.env*`. O Client Secret e os tokens da Strava ficam só em variáveis de ambiente.
