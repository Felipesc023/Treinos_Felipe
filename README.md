# hybrid-run

App pessoal de treino híbrido (corrida + musculação). Este repositório começa pelo **motor de planejamento** (`src/lib/planner`): TypeScript puro, sem banco, sem rede, 100% testável.

## Rodar

Requer Node 20+.

```bash
npm install
npm test          # 50 testes
npm run typecheck
```

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
- Banco (Drizzle + Postgres/Supabase), API, PIN, OAuth e webhook da Strava
- Front-end (vem do Claude Design)

## Segurança

Nunca versionar `.env*`. O Client Secret e os tokens da Strava ficam só em variáveis de ambiente.
