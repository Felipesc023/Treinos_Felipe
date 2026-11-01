# Fases 2 e 3 — Arquitetura e Modelo de Dados

Continuação do PRD (não incluído neste repositório). Premissas herdadas da entrevista: app **pessoal, single-user**, sem cadastro/login tradicional, mobile-first, academia só em máquina, MVP = provas + calendário + planejamento automático + botão de dor/doença. Strava é "se der", notificações ficam pra depois.

---

# FASE 2 — Arquitetura

## 2.1 Princípio guia

Como é um app de uma pessoa só, **a arquitetura certa é um monólito simples**, não microsserviços nem um back-end separado. O que merece cuidado de engenharia de verdade é um único módulo: o **motor de planejamento** (periodização). O resto é CRUD.

## 2.2 Visão geral

```
┌───────────────────────────────────────────────────────────┐
│  Navegador / celular (PWA instalável)                     │
│  Next.js (React + TS + Tailwind + shadcn/ui)              │
└──────────────┬────────────────────────────────────────────┘
               │ Server Actions / Route Handlers
┌──────────────▼────────────────────────────────────────────┐
│  Next.js (App Router) — hospedado na Vercel               │
│                                                           │
│  ┌─────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ UI / Telas  │  │ Camada de serviço│  │ Integrações  │  │
│  │ (RSC + CSR) │─▶│ (casos de uso)   │─▶│ Strava (OAuth│  │
│  └─────────────┘  └───────┬──────────┘  │ + sync)      │  │
│                           │             └──────────────┘  │
│                  ┌────────▼─────────┐                     │
│                  │  /lib/planner    │  ← TypeScript puro, │
│                  │  Motor de        │    sem I/O, 100%    │
│                  │  periodização    │    testável         │
│                  └────────┬─────────┘                     │
└───────────────────────────┼───────────────────────────────┘
                            │ Drizzle ORM
              ┌─────────────▼──────────────┐
              │ PostgreSQL (Supabase)      │
              └────────────────────────────┘
        Vercel Cron (diário) → recalcula "hoje" / sincroniza Strava
```

## 2.3 Stack recomendada

| Camada | Escolha | Por quê |
|---|---|---|
| Front-end | **Next.js 15 (App Router) + React + TypeScript** | Um projeto só para UI e servidor |
| Estilo | **Tailwind CSS + shadcn/ui** | Rápido de montar telas boas e responsivas |
| Gráficos (V1.5) | **Recharts** | Dashboard de evolução |
| Back-end | **Server Actions + Route Handlers do próprio Next.js** | NestJS separado seria exagero para 1 usuário |
| Motor de planejamento | **Módulo TypeScript puro** em `/lib/planner` | Funções puras = fácil de testar com Vitest |
| ORM | **Drizzle ORM** | Tipado, migrations simples, leve |
| Banco | **PostgreSQL (Supabase)** | Free tier cobre com folga; backups automáticos |
| Validação | **Zod** | Schemas compartilhados entre forms e servidor |
| Datas | **date-fns** (ou Temporal quando estável) | Ver armadilha de datas abaixo |
| Hospedagem | **Vercel** (app) + **Supabase** (banco) | Custo ≈ R$ 0 para uso pessoal |
| Jobs | **Vercel Cron** | Rotina diária; sem fila/worker |
| Testes | **Vitest** (planner) + **Playwright** (fluxos críticos) | Foco de teste onde está o risco |
| Observabilidade | **Sentry** (opcional) | Erros em produção |

**Por que não NestJS/Express separado:** adiciona deploy, CORS, autenticação entre serviços e duplicação de tipos, sem benefício para um único usuário. Se um dia virar produto multiusuário, o módulo `/lib/planner` e a camada de serviço já estão isolados e podem ser extraídos.

## 2.4 Autenticação — ponto de atenção

Você pediu "sem login". Concordo no sentido de **não ter cadastro, senha por usuário ou OAuth**. Mas atenção: o app guarda dados sensíveis (doenças, dores, peso). Se a URL ficar pública na Vercel e sem nenhuma barreira, **qualquer pessoa que descobrir o link vê e edita tudo**.

Recomendação mínima (30 minutos de implementação):

- **Portão por PIN/senha única**: middleware do Next.js checa um cookie assinado; se não houver, mostra uma tela com um campo de senha (valor vem de variável de ambiente). Sem tabela de usuários.
- Alternativa ainda mais simples: ativar **Vercel Password Protection** no projeto (plano pago) — não precisa de código.
- Alternativa robusta se quiser multiusuário no futuro: Clerk/Auth.js. **Fora do MVP.**

## 2.5 Integrações externas

| Integração | Fase | Observações |
|---|---|---|
| **Strava API** (OAuth2) | V1 | Importar corridas e inferir PRs. Todo app novo nasce em "single player mode" (1 atleta = você), que é exatamente o seu caso. Limites confirmados na página do app: **geral** 200 req/15 min e 2.000/dia; **leitura** 100 req/15 min e 1.000/dia (o de leitura é o que vale para nós) — sobra para uso pessoal, principalmente com webhook. **O OAuth do app deve pedir o escopo `activity:read_all`**; o token exibido na página do app tem só o escopo `read` e não lê atividades. Tokens expiram em 6h (guardar refresh token criptografado). **Webhook é obrigatório pelos termos** (para saber se você revogou o acesso) e também evita polling. Criar o app exige assinatura Strava ativa. Ver seção 2.9. |
| **Apple Saúde / Apple Watch** | V1 | Não existe API de nuvem do Apple Saúde (HealthKit só roda dentro do iPhone). Caminhos viáveis na seção 2.9. |
| **Google Calendar** | V2 | Mais simples e sem OAuth: expor o plano como **feed .ics** (assinatura de calendário). Funciona no Google/Apple Calendar. |
| **Garmin Connect** | V2+ | A API oficial exige aprovação como parceiro/empresa; para uso pessoal, o caminho realista é o Strava (que recebe do Garmin) ou importar arquivos .FIT/.GPX manualmente. |
| **Coros** | V2+ | Mesma situação: sem API pública aberta; usar Strava como ponte. |
| **Notificações** | V2 | Web Push (PWA) ou e-mail via Resend. |

## 2.6 Decisões de arquitetura (e por quê)

1. **Motor de planejamento = funções puras.** Entrada: perfil, provas, histórico, eventos de saúde, eventos externos. Saída: lista de treinos planejados. Sem acesso a banco dentro dele. Isso permite rodar "e se eu cadastrar essa prova?" sem gravar nada — base para o fluxo **"mostrar proposta antes de aplicar"** que você pediu.
2. **Planos versionados e imutáveis.** Recalcular não edita o plano antigo: cria uma nova versão `proposta`; ao confirmar, ela vira `ativa` e a anterior vira `arquivada`. Dá histórico e permite "desfazer".
3. **Datas como `DATE`, nunca como "nome do dia".** Nunca gravar "terça" no banco; gravar a data (2026-10-20) e **derivar** o dia da semana no código. Esse é exatamente o tipo de bug que apareceu várias vezes no planejamento manual (datas e dias da semana desencontrados). Fuso fixo `America/Sao_Paulo`.
4. **Regras de negócio como dados quando possível.** Intervalo mínimo perna → corrida forte, duração do taper por distância, limites de volume: ficam em um arquivo de configuração tipado (`planner.config.ts`), não espalhados no código.
5. **Biblioteca de exercícios com metadados.** Cada exercício tem flags (`unilateral`, `exige_equilibrio`, `equipamento`, `regioes_sobrecarregadas`). Assim, uma lesão ou a sua preferência por máquina vira um **filtro**, não um "if" solto.
6. **PWA.** Manifest + service worker para instalar na tela inicial e abrir rápido na academia, mesmo com sinal ruim (cache do "treino do dia").

## 2.7 Estrutura de pastas sugerida

```
/app                  → rotas e telas (dashboard, calendario, provas, treino/[data], historico, perfil)
/components           → UI reutilizável
/lib
  /planner            → motor de periodização (puro, testado)
    dates.ts          → datas ISO, dia da semana derivado
    phases.ts         → fases por prova (base/velocidade/pico/taper)
    schedule.ts       → distribuição semanal respeitando regras
    paces.ts          → Riegel, zonas de ritmo, avaliação de meta
    exercises.ts      → biblioteca e filtros de exercícios
    gym.ts            → montagem da sessão e progressão de carga
    rules.ts          → regras duras R0–R8
    config.ts         → parâmetros ajustáveis
    replan.ts         → (futuro) recálculo: doença, treino perdido, nova prova
  /services           → casos de uso (criarProva, confirmarPlano, registrarDor...)
  /integrations       → strava.ts, ics.ts
  /db                 → schema Drizzle, migrations, queries
/tests                → vitest (planner) e playwright (fluxos)
```

## 2.8 Custos estimados (uso pessoal)

Vercel Hobby + Supabase Free: **R$ 0/mês**. A API do Strava é gratuita, mas a documentação diz que criar o app exige assinatura Strava ativa. Se for usar o Apple Saúde via app exportador (seção 2.9), ele tem automações premium (assinatura ou compra no app). Outros custos possíveis: domínio próprio (~R$ 40/ano) e Vercel Pro se quiser proteção por senha nativa.

---

# FASE 3 — Modelo de Banco de Dados

## 3.1 Visão das entidades

```
athletes ─┬─< body_metrics
          ├─< personal_records
          ├─< health_events          (doença / dor / lesão)
          ├─< external_events        (futebol etc.)
          ├─< weekly_template        (dias disponíveis / modalidade)
          ├─< races ─────────────┐
          ├─< integrations       │
          ├─< daily_checkins     │
          └─< training_plans >───┘ (plano mira uma prova)
                 │
                 ├─< plan_phases
                 ├─< plan_change_proposals
                 └─< planned_workouts ─┬─ run_workouts      (1:1)
                          │            └─< gym_workout_items >─ exercises
                          └─< workout_executions ─< gym_set_logs
notifications (V2)
```

`<` = um-para-muitos.

## 3.2 Tabelas

Convenções: `id` UUID, `created_at`/`updated_at` em todas, datas como `DATE`, durações em segundos, distâncias em metros, pace em segundos/km. Como é single-user, existe **uma linha** em `athletes`; manter `athlete_id` como FK custa quase nada e deixa a porta aberta para multiusuário.

### athletes
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| name | text | |
| birth_date | date | idade calculada |
| sex | enum(`M`,`F`,`outro`) | |
| height_cm | int | |
| level | enum(`iniciante`,`intermediario`,`avancado`) | fallback até haver histórico |
| gym_machines_only | bool default true | preferência: só máquina |
| avoid_unilateral | bool default true | evita exercícios unilaterais |
| timezone | text default `America/Sao_Paulo` | |

### body_metrics
`id`, `athlete_id`, `date`, `weight_kg numeric(5,2)`, `body_fat_pct numeric(4,1) null`, `notes`. **Unique (athlete_id, date).** Peso influencia o cálculo de volume (ex.: meta de emagrecimento).

### personal_records
`id`, `athlete_id`, `distance_m`, `time_seconds`, `achieved_on date`, `source enum(manual, strava, apple_health)`, `external_id null`. A PR vigente por distância é a mais recente/melhor; base de **todos** os paces de treino.

### health_events (doença, dor, lesão)
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| athlete_id | FK | |
| kind | enum(`doenca`,`dor`,`lesao`) | |
| body_region | text null | `joelho`, `lombar`, `garganta`… |
| severity | smallint 1–5 | |
| started_on | date | |
| expected_end_on | date null | |
| ended_on | date null | preenchido ao se recuperar |
| restrictions | jsonb | ex.: `{"sem_impacto":true,"evitar_regioes":["joelho"],"max_rpe":4}` |
| status | enum(`ativo`,`em_retomada`,`resolvido`) | |

Alimenta o botão "estou doente / com dor": criar um registro aqui dispara o replanejamento.

### external_events (futebol, etc.)
`id`, `athlete_id`, `date`, `title`, `load_level enum(baixa,media,alta)`, `affects_legs bool`, `recurrence jsonb null`. O motor trata como **carga extra** ao montar a semana.

### weekly_template (disponibilidade)
`athlete_id`, `weekday smallint (0–6)`, `allowed jsonb` (ex.: `["corrida","academia"]`), `is_rest bool`, `preferred_modality null`. Guarda o seu padrão (domingo e quarta de descanso, longão no sábado…). É a **preferência**, não o plano — o plano pode se desviar dele quando as regras exigirem.

### races
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| athlete_id | FK | |
| name | text | |
| race_date | date | |
| distance_m | int | 5000, 10000, 21097, 42195… |
| goal_type | enum(`pr`,`terminar`,`ambos`) | seu "um pouco dos dois" |
| goal_time_seconds | int null | |
| priority | enum(`A`,`B`,`C`) | A = prova-alvo principal |
| status | enum(`futura`,`concluida`,`cancelada`) | |
| result_time_seconds | int null | alimenta PRs |

### training_plans
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| athlete_id | FK | |
| target_race_id | FK → races | prova que guia o plano |
| version | int | incrementa a cada recálculo |
| status | enum(`proposta`,`ativa`,`arquivada`,`rejeitada`) | |
| supersedes_plan_id | FK null | encadeia versões |
| generation_inputs | jsonb | snapshot das entradas (reprodutibilidade) |
| rationale | text | **por que** esta versão existe ("doença de 5 dias", "nova prova B em 12/12") |
| generated_at | timestamptz | |

**Regra:** no máximo **um plano `ativa`** por atleta (índice único parcial).

### plan_phases
`id`, `plan_id`, `phase enum(retomada, base, velocidade, pico, taper, prova)`, `start_date`, `end_date`, `params jsonb` (volume-alvo, foco da musculação, etc.).

### planned_workouts
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| plan_id | FK | |
| date | date | **nunca** o nome do dia |
| slot | smallint default 1 | permite 2 treinos no mesmo dia |
| modality | enum(`corrida`,`academia`,`descanso`,`prova`) | |
| workout_type | enum(`leve`,`longao`,`intervalado`,`tempo`,`ativacao`,`academia_inferior`,`academia_superior`,`prova`,`descanso`,`externo`) | |
| title | text | |
| description | text | |
| intensity | smallint 0–5 | usado nas regras de recuperação |
| leg_load | smallint 0–3 | carga nas pernas, base da regra dos 2 dias |
| status | enum(`planejado`,`feito`,`pulado`,`perdido`,`movido`) | |
| moved_from_date | date null | rastreia reencaixes |

Índice: `(plan_id, date)`.

### run_workouts (1:1 com planned_workouts de corrida)
`planned_workout_id PK/FK`, `total_distance_m null`, `total_duration_s null`, `pace_min_s_km`, `pace_max_s_km`, `structure jsonb` — ex.: `{"aquecimento_min":10,"series":[{"reps":6,"distancia_m":600,"pace_s_km":[153,159],"recuperacao":{"tipo":"trote","distancia_m":200}}],"desaquecimento_min":10}`. A estrutura em JSON evita criar uma tabela por tipo de tiro.

### exercises (biblioteca)
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| name | text | "Leg press 45°" |
| movement_pattern | text | `leg_press`, `knee_ext`, `push_h`… (usado pelo motor para montar a sessão) |
| muscle_group | enum(`quadriceps`,`posterior`,`gluteo`,`panturrilha`,`peito`,`costas`,`ombro`,`core`,`adutores`,`abdutores`,`lombar`) | |
| equipment | enum(`maquina`,`cabo`,`livre`,`peso_corporal`) | |
| unilateral | bool | |
| balance_demand | smallint 0–3 | o búlgaro seria 3 |
| leg_load | smallint 0–3 | |
| stresses_regions | text[] | para filtrar por lesão |
| substitute_of | uuid null | equivalente mais fácil |

O filtro padrão do seu perfil: `equipment IN ('maquina','cabo') AND unilateral = false AND balance_demand <= 1`.

### gym_workout_items
`id`, `planned_workout_id`, `exercise_id`, `position`, `sets`, `reps_min`, `reps_max`, `rest_s`, `load_note text` (ex.: "aumente a carga da semana passada"), `tempo text null`.

### workout_executions (histórico de execução)
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| athlete_id | FK | |
| planned_workout_id | FK null | `null` = treino avulso/importado |
| executed_on | date | |
| outcome | enum(`completo`,`parcial`,`pulado`) | |
| actual_distance_m | int null | |
| actual_duration_s | int null | |
| avg_pace_s_km | int null | |
| rpe | smallint 1–10 null | esforço percebido |
| notes | text | |
| source | enum(`manual`,`strava`,`apple_health`) | |
| external_id | text null | id na origem; `unique (source, external_id)` evita duplicar importação |

### gym_set_logs
`id`, `execution_id`, `exercise_id`, `set_number`, `reps`, `load_kg numeric(5,1)`, `rpe null`. Base do **ajuste automático de carga** (V1.5).

### daily_checkins (V1.5)
`athlete_id`, `date`, `fatigue 1–5`, `sleep_hours`, `soreness jsonb` (mapa por região), `mood`, `notes`. **Unique (athlete_id, date).** No MVP, o que importa é `health_events`; esta tabela entra com sono/fadiga depois.

### plan_change_proposals
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| athlete_id | FK | |
| trigger | enum(`nova_prova`,`doenca`,`dor`,`treino_perdido`,`evento_externo`,`manual`) | |
| trigger_ref_id | uuid null | prova/evento que causou |
| from_plan_id | FK | plano ativo atual |
| to_plan_id | FK | plano `proposta` gerado |
| diff | jsonb | resumo: treinos removidos/adicionados/movidos |
| explanation | text | texto mostrado ao usuário |
| status | enum(`pendente`,`aceita`,`rejeitada`) | |
| decided_at | timestamptz null | |

É a tabela que implementa **"recalcula, mostra e pede confirmação"**.

### integrations
`athlete_id`, `provider enum(strava, garmin, coros, google)`, `external_athlete_id`, `access_token_enc`, `refresh_token_enc`, `expires_at`, `scope`, `last_synced_at`. Tokens **criptografados** (AES-GCM com chave em variável de ambiente).

### notifications (V2)
`id`, `athlete_id`, `type`, `scheduled_for`, `sent_at null`, `payload jsonb`, `channel enum(push,email)`.

## 3.3 Relacionamentos-chave (resumo)

- **Uma prova → vários planos (versões); um plano ativo.** `training_plans.target_race_id → races.id`. Cadastrar nova prova ou registrar doença gera uma `plan_change_proposals` apontando para o plano atual e para o novo `proposta`.
- **Plano → fases e treinos.** `plan_phases` descrevem o macro (base → velocidade → pico → taper); `planned_workouts` são o micro (dia a dia).
- **Treino planejado ↔ execução.** Um `planned_workout` pode ter 0..N `workout_executions` (ex.: feito em duas partes). A execução pode existir sem treino planejado (corrida importada do Strava).
- **Treino de corrida vs. academia.** Mesma tabela-mãe (`planned_workouts`) com detalhe em `run_workouts` (1:1) ou `gym_workout_items` (1:N → `exercises`).
- **Saúde e eventos externos** não pertencem ao plano: pertencem ao atleta e são **entrada** do motor.

## 3.4 Constraints e índices que evitam bugs reais

- Índice único parcial: apenas um `training_plans.status = 'ativa'` por atleta.
- `unique (athlete_id, date)` em `body_metrics` e `daily_checkins`.
- `unique (source, external_id)` em `workout_executions` (importação idempotente).
- Data da prova no futuro: validar **na aplicação** (Zod) ao criar. Não usar `CHECK` com `current_date` — não é imutável e quebra restauração de backup.
- `check (distance_m > 0)`, `check (rpe between 1 and 10)`.
- Índices: `planned_workouts (plan_id, date)`, `races (athlete_id, race_date)`, `health_events (athlete_id, status)`.

## 3.5 DDL de referência (trecho, PostgreSQL)

```sql
create type race_goal as enum ('pr','terminar','ambos');
create type plan_status as enum ('proposta','ativa','arquivada','rejeitada');
create type modality as enum ('corrida','academia','descanso','prova');

create table races (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id),
  name text not null,
  race_date date not null,
  distance_m int not null check (distance_m > 0),
  goal_type race_goal not null default 'ambos',
  goal_time_seconds int,
  priority char(1) not null default 'A' check (priority in ('A','B','C')),
  status text not null default 'futura',
  result_time_seconds int,
  created_at timestamptz not null default now()
);

create table training_plans (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id),
  target_race_id uuid not null references races(id),
  version int not null,
  status plan_status not null default 'proposta',
  supersedes_plan_id uuid references training_plans(id),
  generation_inputs jsonb not null,
  rationale text not null,
  generated_at timestamptz not null default now()
);
create unique index one_active_plan_per_athlete
  on training_plans (athlete_id) where status = 'ativa';

create table planned_workouts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references training_plans(id) on delete cascade,
  date date not null,
  slot smallint not null default 1,
  modality modality not null,
  workout_type text not null, -- ver enum em 3.2
  title text not null,
  description text,
  intensity smallint check (intensity between 0 and 5),
  leg_load smallint check (leg_load between 0 and 3),
  status text not null default 'planejado',
  moved_from_date date,
  unique (plan_id, date, slot)
);
create index on planned_workouts (plan_id, date);
```

---

---

# ADENDO — Ingestão automática de treinos (Strava + Apple Watch)

Objetivo: você **não digitar nada**. O treino feito no relógio chega sozinho ao app, é comparado com o planejado e alimenta o replanejamento.

## 2.9 Como cada fonte pode chegar ao app

| Caminho | Como funciona | Automático? | Observações |
|---|---|---|---|
| **A. Apple Watch → Strava → app** (recomendado) | O treino do relógio sobe para o Strava; o Strava avisa o app por **webhook**; o app busca os detalhes pela API | Sim, em segundos/minutos | Mais confiável. Não depende do iPhone estar aberto. Precisa de assinatura Strava para criar o app. Confira no Strava (Configurações) se a conexão com o Apple Saúde/Apple Watch está ativa; é ela que decide se seus treinos chegam lá. |
| **B. Apple Saúde → app exportador → app** | Um app de iPhone (ex.: **Health Auto Export**) lê o Apple Saúde e envia JSON via REST para um endpoint seu | Quase. Roda em segundo plano, e o iOS limita isso | Exportação por REST é recurso premium do app. Relatos indicam que às vezes precisa abrir o app para "dar um empurrão". Serve bem para o que o Strava não traz. |
| **C. App iOS próprio com HealthKit** | Um app nativo seu lê o HealthKit direto | Sim | Exige Xcode/Mac e conta de desenvolvedor Apple. Complexidade alta para ganho pequeno. **Não recomendo agora.** |
| **D. Arquivo .FIT/.GPX manual** | Você exporta e sobe o arquivo | Não | Plano de contingência. |

**Recomendação:** usar **A como fonte principal** e **B só como complemento** para dados que o Strava não oferece (sono, frequência cardíaca de repouso, variabilidade cardíaca, peso). Isso encaixa no V2 (registro de sono e fadiga) sem trabalho manual.

## 2.10 O que cada fonte entrega

| Dado | Strava | Apple Saúde (via exportador) |
|---|---|---|
| Corrida: distância, tempo, pace, parciais (laps/splits), FC média e máxima | Sim | Sim |
| Tiros: parciais por repetição | Sim, se você usar o botão de lap/treino estruturado no relógio | Sim, via segmentos do treino |
| Musculação: séries, repetições, cargas | **Não** (só duração e FC) | **Não** (só duração e FC) |
| Sono, FC de repouso, variabilidade cardíaca | Não | Sim |
| Peso corporal | Não | Sim, se registrado no Apple Saúde |

**Limite honesto:** o relógio sabe que você ficou 55 minutos na academia, mas não sabe quanto pesou o leg press. Para musculação, o app vai poder confirmar automaticamente **"treino feito, duração X, FC Y"**, e as cargas continuam sendo um toque rápido seu (ou "mesma carga da semana passada" com um botão). A parte de corrida, que é a mais valiosa, fica 100% automática.

## 2.11 Fluxo da ingestão

```
Apple Watch ──▶ Strava ──webhook──▶ POST /api/strava/webhook
                                          │ (responde 200 rápido)
                                          ▼
                              fila simples (tabela ingestion_events)
                                          ▼
                       busca atividade + laps na API do Strava
                                          ▼
                    normaliza → workout_executions (source = strava)
                                          ▼
                 casa com planned_workouts do dia (data + tipo + distância)
                                          ▼
                    avalia (planejado vs. realizado) → grava avaliação
                                          ▼
              regras do motor decidem: segue o plano / propõe ajuste
```

Regras práticas:
- **Webhook responde em < 2 s** e só grava o evento; o processamento pesado acontece depois. A Strava espera resposta rápida.
- **Idempotência:** o mesmo evento pode chegar duas vezes. A chave única `(source, external_id)` impede duplicar.
- **Deduplicação entre fontes:** se a mesma corrida chegar pelo Strava e pelo exportador do Apple Saúde, considera-se duplicada quando o início difere em até ~5 min e a distância em até ~3%. Vale a fonte com mais detalhe (parciais).
- **Casamento com o plano:** busca o treino planejado da mesma data; se houver dois candidatos (ex.: leve + intervalado), escolhe pelo tipo/distância. Se não houver correspondência, registra como **treino avulso**, sem quebrar o plano.
- **Backfill:** na primeira conexão, importar só os últimos 60–90 dias (poucas chamadas), respeitando os cabeçalhos de limite de requisições.
- **Apenas seus dados:** em single player mode o app só exibe dados do próprio atleta autenticado, o que atende o que o contrato da API exige.

## 2.12 Avaliação automática do treino (planejado vs. realizado)

Para cada execução, o motor calcula:

| Medida | Como | Resultado |
|---|---|---|
| Cumprimento de volume | distância/tempo realizado ÷ planejado | `abaixo` (<85%), `ok` (85–115%), `acima` (>115%) |
| Aderência de ritmo | pace médio (ou médio dos tiros) dentro da faixa-alvo? | `lento`, `no alvo`, `rápido` |
| Qualidade dos tiros | variação entre repetições (a última não pode cair muito vs. a primeira) | `consistente` / `desgastou` |
| Intensidade interna | FC média vs. zonas (estimadas por FC máxima observada) | `leve demais` / `ok` / `forte demais` |
| Leve que virou forte | corrida leve com FC/ritmo de zona alta | alerta: "você correu rápido demais no leve" |

**Como isso vira ação** (entra detalhado na Fase 4):
- 2 treinos de qualidade seguidos `no alvo` e FC confortável → sugere subir um degrau de ritmo/volume.
- Tiros `desgastou` + leves `forte demais` → sugere reduzir carga ou inserir descanso (sinal de acúmulo de fadiga).
- Treino planejado sem nenhuma execução até o fim do dia → marca como `perdido` e dispara o replanejamento proposto, com confirmação sua.
- PR novo detectado numa distância (corrida completa ≥ distância-alvo) → atualiza `personal_records` e recalcula todos os paces.

**Cuidado:** a avaliação é um **apoio**, não um diagnóstico. Dor, doença e fadiga que você relata continuam tendo prioridade sobre o que os números sugerem.

## 3.6 Ajustes no banco para a ingestão

**workout_executions** (campos novos):
`source enum(manual, strava, apple_health)`, `external_id text`, `device text null`, `avg_hr smallint null`, `max_hr smallint null`, `elevation_gain_m int null`, `calories int null`, `laps jsonb null` (parciais: distância, tempo, pace, FC), `match_confidence enum(exato, provavel, avulso)`. Troca o antigo `strava_activity_id` por **`unique (source, external_id)`**.

**execution_evaluations** (nova): `execution_id PK/FK`, `volume_status`, `pace_status`, `consistency_status`, `intensity_status`, `flags text[]`, `summary text`, `evaluated_at`. É o resultado da seção 2.12, guardado para o histórico e para o replanejamento citar o motivo.

**ingestion_events** (nova): `id`, `source`, `event_type`, `external_id`, `payload jsonb`, `status enum(recebido, processado, erro)`, `error text null`, `received_at`, `processed_at null`. Funciona como fila e como log de auditoria; permite reprocessar sem pedir de novo à API.

**health_metrics** (nova, V2, vinda do Apple Saúde): `athlete_id`, `date`, `metric enum(sono_horas, fc_repouso, hrv, peso_kg)`, `value numeric`, `source`. **Unique (athlete_id, date, metric, source).** Alimenta fadiga/sono sem digitação.

**integrations** ganha: `webhook_subscription_id`, `status enum(ativa, revogada, erro)`, `revoked_at null`.

## 2.13 Riscos da ingestão

1. **Dependência da Strava.** O contrato diz que ela pode alterar ou encerrar o acesso à API a qualquer momento. Mitigação: guardar tudo que for importado e manter a entrada manual e o caminho B como alternativas. Há também uma política de API separada (API Policy) que eu não li inteira; vale você conferir antes de ligar.
2. **iOS e segundo plano.** O caminho B pode atrasar. Por isso ele é complemento, não a fonte principal.
3. **Qualidade dos dados do relógio.** GPS ruim ou pausas automáticas distorcem pace. O motor deve ignorar execuções com distância/tempo implausíveis em vez de "avaliar" um dado errado.
4. **Privacidade.** São dados de saúde. Tokens criptografados, endpoint de webhook validado, e o portão de PIN da seção 2.4 continuam obrigatórios.

---

## 2.14 Front-end desenhado no Claude Design (desacoplado)

Decisão de fluxo: o **back-end** é feito aqui; o **front-end** é desenhado no Claude Design e depois integrado. Para a troca de telas ser fácil e não quebrar nada:

- **Contrato único de dados** em `/lib/contracts`: schemas Zod + tipos TypeScript (treino do dia, mês do calendário, proposta de ajuste, prova, execução). O Claude Design e o back-end seguem o mesmo contrato.
- **Componentes de tela puros:** recebem tudo por props e não buscam dados. Uma camada fina em `/app` (páginas e Server Actions) busca os dados e entrega aos componentes. Trocar o visual = trocar componentes, sem mexer em regra de negócio.
- **Mocks primeiro:** a pasta `/mocks` tem os JSONs de exemplo (os mesmos do brief). O front roda 100% com mocks antes de existir banco, e a ligação real entra depois, tela por tela.
- **Estilo:** o plano usa Tailwind. Se o código exportado pelo Claude Design vier com outra abordagem de estilo, a conversão é trabalho de integração, sem impacto no back-end.
- **Fonte da verdade das regras:** o front nunca recalcula plano, ritmo ou regra de recuperação; só exibe o que o motor devolve (inclusive a explicação em texto).

## O que decidi por você (me diga se discorda)

1. **Monólito Next.js** em vez de NestJS separado.
2. **Portão de PIN único** em vez de "sem nenhuma proteção" (por causa dos dados de saúde).
3. **Strava como ponte** para Garmin/Coros, em vez de integrar cada marca.
4. **Mantive `athlete_id` em tudo**, mesmo sendo single-user, para não precisar refazer o banco se um dia virar produto.

**Próximo passo: Fase 4 — algoritmos de negócio** (periodização, distribuição semanal, regra dos 2 dias, taper, recálculo por doença/treino perdido/nova prova).
