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
5. **Deploy (Vercel):** importe o repositório do GitHub e cadastre as mesmas variáveis (`APP_URL` = URL do site).

## O site

PIN → **Hoje** (contagem da prova, fase, treino do dia, semana, último treino da Strava) · **Calendário** · **Provas** (cadastro + avaliação da meta) · **Perfil** (recordes, Strava). O plano é calculado na hora a partir da prova A e dos recordes (`src/lib/plan.ts`), sem gravar versões: mudou prova ou recorde, o plano muda.

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

- `generatePlan`: montar o ciclo inteiro (fases × semanas × volumes de km)
- Replanejamento: doença/dor, treino perdido, prova nova, edição manual (`proposeReplan`)
- `evaluateExecution`: planejado × realizado (Strava)
- Propostas de ajuste com confirmação, botão de doença/dor, planos versionados
- Tela de treino com cargas, histórico completo, PWA/offline
- Visual final do Claude Design (as telas atuais seguem o brief, mas são simples)

## Segurança

Nunca versionar `.env*`. O Client Secret e os tokens da Strava ficam só em variáveis de ambiente.
