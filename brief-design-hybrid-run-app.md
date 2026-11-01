# Fase 5 — Brief de Design (entrada para o Claude Design)

Este documento descreve **o que desenhar** (telas, dados, estados, interações). A parte de dados e regras já está definida no back-end (`arquitetura-e-banco-hybrid-run-app.md` e o código em `src/lib/planner`). No fim há um prompt pronto para colar no Claude Design.

---

## 1. Contexto do produto (cole isto primeiro)

App **pessoal, de um único usuário**, em português do Brasil, para um corredor amador que também faz musculação. Ele planeja automaticamente os treinos de corrida e academia a partir das provas cadastradas, importa os treinos feitos pelo Apple Watch via Strava, avalia o que foi feito e **propõe** ajustes (nunca aplica sozinho) quando algo foge do plano: doença, dor, treino perdido, prova nova, jogo de futebol.

- **Uso principal:** celular, uma mão, entre séries na academia ou antes de correr. **Mobile-first**, com versão desktop simples.
- **Tom:** direto, calmo, de treinador. Sem gamificação exagerada. Sempre explica **por que** mudou algo.
- **Não desenhar:** cadastro de múltiplos usuários, login com e-mail, feed social, notificações push (fica para depois), integração Garmin/Coros.

## 2. Identidade visual

Já existe uma identidade validada nos trackers anteriores. Manter.

| Token | Valor | Uso |
|---|---|---|
| `bg` | `#11141C` | fundo |
| `surface` | `#1B1F2A` | cartões |
| `surfaceAlt` | `#222738` | cartões internos, itens |
| `border` | `#2C3244` | bordas |
| `text` | `#EDEFF5` | texto principal |
| `textMuted` | `#8D93A9` | texto secundário |
| `textFaint` | `#5D6478` | rótulos, legendas |
| `gold` | `#E8B04B` | **hoje**, prova, destaque principal |
| `sky` | `#5AA9E6` | corrida leve |
| `amber` | `#E8934A` | academia |
| `red` | `#E8654F` | intervalado / alerta |
| `emerald` | `#4CAF82` | longão / concluído |
| `slate` | `#5B6275` | descanso |

- **Tema:** escuro por padrão, com opção de claro (definir equivalentes).
- **Tipografia:** sans do sistema para texto; **monoespaçada para números** (pace, tempo, distância, séries), como um cronômetro. Títulos em caixa alta pequena com espaçamento nos rótulos.
- **Forma:** cantos 12–14 px, bordas finas, sem sombras pesadas.
- **Ícones (lucide):** Timer (leve), Dumbbell (academia), Zap (intervalado), TrendingUp (longão), Moon (descanso), Trophy (prova), Activity (futebol/evento externo), HeartPulse (saúde).
- **Acessibilidade:** alvos de toque ≥ 44 px, contraste AA, nunca usar só cor para indicar estado (ícone + texto).

## 3. Mapa de navegação

```
[PIN] → [Onboarding (1ª vez)] → App
App (barra inferior):  Hoje | Calendário | Provas | Histórico | Mais
Mais → Perfil | Configurações | Conexões
Sempre acessível (botão flutuante em Hoje e Calendário): "Estou doente / com dor"
Fluxos que levam à tela "Proposta de ajuste":
   nova prova · doença/dor · treino perdido · novo evento externo · mudança de meta
```

---

## 4. Telas

Legenda dos wireframes: `[ ]` botão · `( )` opção · `░░` barra de progresso · `●` marcador.

### 4.1 Entrada (PIN) — substitui Landing + Login

Propósito: proteger dados de saúde sem conta de usuário.

```
┌───────────────────────────┐
│        [ícone do app]     │
│     Treinos · Felipe      │
│                           │
│   Digite seu PIN          │
│      ○ ○ ○ ○ ○ ○          │
│                           │
│   [1] [2] [3]             │
│   [4] [5] [6]             │
│   [7] [8] [9]             │
│   [ ] [0] [⌫]             │
│                           │
│   ☐ Lembrar neste aparelho│
└───────────────────────────┘
```
Estados: erro ("PIN incorreto"), bloqueio temporário após 5 tentativas, carregando.

### 4.2 Onboarding (primeiro acesso) — substitui Cadastro

Fluxo de 5 passos com barra de progresso no topo e botão Voltar.

1. **Perfil:** nome, data de nascimento, sexo, altura (cm), peso (kg).
2. **Recordes (PRs):** campos para 5 km, 10 km, 21 km, 42 km (opcionais, formato `mm:ss`). Botão **"Importar do Strava"**. Mostra o pace calculado ao digitar.
3. **Disponibilidade semanal:** grade de 7 dias. Para cada dia: `Descanso | Corrida | Academia | Ambos` e **tempo máximo disponível** (ex.: 45 / 60 / 90 min). Sugestão automática pré-preenchida (editável).
4. **Preferências:** `Academia só com máquina` (ligado), `Evitar exercícios unilaterais/de equilíbrio` (ligado), foco da musculação (`Suporte à corrida` / `Estética` / `Os dois`), objetivo de longo prazo (`Meia maratona`, etc.).
5. **Conectar Strava** (botão grande) ou "Pular por agora".

### 4.3 Hoje (Dashboard)

```
┌───────────────────────────────┐
│ SEX, 06 NOV · HOJE        ⚙   │  ← data de hoje em dourado
│                               │
│  PROVA 5KM · 15/11            │
│       9 dias                  │  ← contagem, fonte mono grande
│  Fase: Pico  ░░░░░░░░░░░ 87%  │
│                               │
│ ┌───────────────────────────┐ │
│ │ ⚡ INTERVALADO            │ │  ← cartão do treino de hoje
│ │ 4×1000 m no ritmo-alvo    │ │
│ │ 4:25–4:35 /km · ~55 min   │ │
│ │ [Ver treino completo]     │ │
│ └───────────────────────────┘ │
│                               │
│ Semana  D S T Q Q S S         │
│         ● ● ● ● ● ◉ ○         │  ← feitos / hoje (◉) / pendentes
│                               │
│ ⚠ Seu último leve saiu forte  │  ← alerta do motor (opcional)
│   FC média acima da zona      │
│                               │
│ Último treino importado       │
│  Strava · 6,0 km · 6:08 /km   │
│  Plano ✓ no alvo              │
│                               │
│ [ ❤ Estou doente / com dor ]  │
└───────────────────────────────┘
```
Estados: dia de descanso (mensagem tranquila + próximo treino), dia de prova (destaque total), sem prova cadastrada (convite para cadastrar), treino já concluído, sincronizando Strava.

### 4.4 Calendário

Mês em grade 7 colunas (domingo a sábado). Cada célula: número do dia + ponto colorido do tipo de treino + ✓ se concluído. **Hoje** com borda dourada; dia selecionado com borda clara; dia da prova com fundo dourado translúcido; evento externo (futebol) com ícone Activity.

```
┌───────────────────────────────┐
│ ‹   Novembro 2026   ›  [Hoje] │
│ [Mês | Semana]                │
│ D  S  T  Q  Q  S  S           │
│ 1  2  3  4  5  6  7           │
│    ●  ●     ●  ●  ●           │
│ ...                           │
│ Legenda: ● leve ● academia ...│
│ ─────────────────────────────  │
│ QUI, 05/11                    │  ← painel do dia selecionado
│ ⚡ Intervalado                 │
│ 4×1000 m · 4:25–4:35          │
│ [Marcar concluído] [Mover…]   │
│ [+ Evento (ex.: futebol)]     │
└───────────────────────────────┘
```
- **"Mover…"** abre seletor de data. Se a nova data violar uma regra de recuperação, mostra aviso com o motivo ("fica a menos de 2 dias de uma perna") e permite **confirmar mesmo assim**.
- Alternância **Semana**: lista vertical dos 7 dias com o treino resumido.

### 4.5 Treino do dia (detalhe)

Corrida:
```
┌───────────────────────────────┐
│ ‹  QUI 05/11   ⚡ Intervalado │
│ Por que hoje: velocidade na   │
│ fase de pico, 2 dias após a   │
│ última perna.                 │
│ ───────────────────────────── │
│ Aquecimento   10 min leve     │
│ 4 × 1000 m    4:25–4:35 /km   │
│ Recuperação   3 min trote     │
│ Desaquecimento 10 min         │
│ ───────────────────────────── │
│ Se importado do Strava:       │
│  Rep 1  4:31 ✓                │
│  Rep 2  4:29 ✓                │
│  Rep 3  4:38 ⚠ acima          │
│  Rep 4  4:41 ⚠ acima          │
│  Plano: cumprido, desgastou   │
│ ───────────────────────────── │
│ Como foi? (esforço 1–10)  ───●│
│ Notas…                        │
│ [ Marcar como concluído ]     │
└───────────────────────────────┘
```

Academia:
```
┌───────────────────────────────┐
│ ‹  SEX 06/11   🏋 Academia B  │
│ Bloco 3 · semana de taper     │
│ ───────────────────────────── │
│ Supino na máquina    3×10     │
│   Série 1  [ 40 kg ] [10] ✓   │
│   Série 2  [ 40 kg ] [10] ✓   │
│   Série 3  [ 40 kg ] [ 9] ✓   │
│   [ Mesma carga da semana ]   │
│ Puxador alto         3×10     │
│ ...                           │
│ Duração/FC (se importado): 48 min · 112 bpm │
│ [ Marcar como concluído ]     │
└───────────────────────────────┘
```
Aviso se o exercício foi trocado por restrição (ex.: "evitamos unilateral por equilíbrio").

### 4.6 Provas

- **Lista:** cartões ordenados por data, com prioridade A/B/C, distância, objetivo (`PR`, `Terminar`, `Os dois`), meta de tempo, **avaliação da meta** (`Realista`, `Ambiciosa`, `Inviável`) com explicação curta, e dias restantes.
- **Cadastro/edição:** nome, data, distância (5/10/21/42 km ou outra), objetivo, meta de tempo (opcional), prioridade. Ao salvar → **Proposta de ajuste** (4.7).
- Estado vazio: "Nenhuma prova cadastrada. Cadastre a primeira para gerar seu plano."

### 4.7 Proposta de ajuste (tela-chave)

Aparece sempre que o motor recalcula. **Nada é aplicado antes de você confirmar.**

```
┌───────────────────────────────┐
│ Proposta de ajuste            │
│ Motivo: doença de 9 dias      │
│ ───────────────────────────── │
│ Meta: 22:30 → INVIÁVEL        │
│ Sugestão: correr para terminar│
│  largada 5:20–5:30 /km        │
│ ───────────────────────────── │
│ O que muda                    │
│  − Removido  Intervalado 12/11│
│  ↔ Movido    Leve 10/11 → 11/11│
│  + Adicionado Leve curta 13/11│
│  ↓ Reduzido  Academia A (50%) │
│ Por quê: retomada pós-doença… │
│ ───────────────────────────── │
│ [Ver antes/depois]            │
│ [ Aceitar ] [ Recusar ] [Ajustar]│
└───────────────────────────────┘
```
Visualização "antes/depois": duas semanas lado a lado, com diferenças destacadas.

### 4.8 Estou doente / com dor (folha inferior)

Passos: `Doença | Dor | Lesão` → (se dor/lesão) **região** (lista ou silhueta simples) → **gravidade** 1–5 → **desde quando** → **previsão de volta** (opcional) → **sintomas** (febre, aperto no peito, falta de ar, mal-estar geral) → enviar.
- Aviso fixo e discreto: "O app não faz diagnóstico. Sintomas fortes ou que persistem pedem avaliação de um profissional de saúde."
- Se marcar febre, aperto no peito ou falta de ar, a resposta recomenda **descanso e avaliação** e não propõe corrida.
- Ao enviar → Proposta de ajuste (4.7).
- Evento ativo aparece como faixa no topo de Hoje, com botão **"Já melhorei"** (inicia a retomada).

### 4.9 Histórico

- Lista cronológica de execuções com selo: `Feito`, `Parcial`, `Pulado`, `Perdido`, origem (Strava / manual).
- Filtros: tipo (corrida/academia), período, status.
- Detalhe: planejado vs. realizado, parciais, FC, avaliação do motor.
- **V1.5:** gráficos (volume semanal, pace médio por tipo, peso corporal) e quadro de PRs.

### 4.10 Perfil

Dados pessoais, **registro de peso** (data + kg, com mini-gráfico), PRs (editáveis; marca quais vieram do Strava), histórico de eventos de saúde, preferências de treino.

### 4.11 Configurações e conexões

- **Strava:** status (`Conectado`/`Desconectado`/`Erro`), última sincronização, [Reconectar], [Desconectar]. Texto: "treinos do Apple Watch chegam via Strava".
- **Apple Saúde:** "Em breve" (V2) para sono e variabilidade.
- **Semana-padrão:** a grade de disponibilidade e tempo por dia.
- **Regras do plano (avançado, recolhido):** intervalo mínimo entre perna e corrida forte, número de dias de academia, etc., com texto explicando cada uma.
- **Segurança:** trocar PIN, sair deste aparelho.
- **Dados:** exportar (JSON/CSV), apagar tudo.
- **Aparência:** tema.

---

## 5. Estados globais para desenhar

- **Carregando** (esqueletos nos cartões), **vazio**, **erro** (com ação de tentar de novo), **offline** (o treino do dia continua visível, com selo "sem conexão").
- **Sincronização:** indicador discreto "Strava sincronizado há 2 min".
- **Confirmações destrutivas:** recusar proposta, apagar dados, desconectar.

## 6. Dados de exemplo (para o Claude Design prototipar com conteúdo real)

**Treino do dia**
```json
{
  "date": "2026-11-05",
  "type": "intervalado",
  "title": "Intervalado — no pace-meta",
  "intensity": 4,
  "legLoad": 2,
  "estMinutes": 55,
  "rationale": "Última qualidade antes do taper, 3 dias depois da última perna.",
  "run": {
    "warmupMin": 10,
    "sets": [{ "reps": 4, "distanceM": 1000, "paceSecPerKm": [265, 275],
               "recovery": { "kind": "trote", "durationS": 180 } }],
    "cooldownMin": 10
  },
  "status": "planejado"
}
```

**Item de academia**
```json
{ "exercise": "Leg press 45°", "sets": 4, "reps": [8, 8], "loadNote": "aumente a carga da semana passada",
  "previous": { "loadKg": 120, "reps": [8, 8, 8, 7] } }
```

**Proposta de ajuste**
```json
{
  "trigger": "doenca",
  "explanation": "Você ficou 9 dias sem treinar e faltam 6 para a prova.",
  "goalAssessment": { "before": "ambiciosa", "after": "inviavel",
                      "suggestion": "Correr para terminar; largada 5:20–5:30/km." },
  "diff": [
    { "op": "removed", "date": "2026-11-12", "title": "Intervalado" },
    { "op": "moved", "from": "2026-11-10", "to": "2026-11-11", "title": "Corrida leve" },
    { "op": "reduced", "date": "2026-11-09", "title": "Academia A", "detail": "carga a 50%" }
  ]
}
```

**Prova**
```json
{ "name": "5 km", "date": "2026-11-15", "distanceM": 5000, "goalType": "ambos",
  "goalTimeSeconds": 1350, "priority": "A", "goalAssessment": "ambiciosa" }
```

---

## 7. Prompt pronto para o Claude Design

> Crie um protótipo mobile-first (390 px) e uma versão desktop simples de um app **pessoal** de treino híbrido (corrida + musculação) em **português do Brasil**. É de um único usuário, protegido por PIN. Tom calmo e direto, de treinador, sem gamificação.
>
> **Identidade:** tema escuro. Fundo `#11141C`, cartões `#1B1F2A`, bordas `#2C3244`, texto `#EDEFF5`. Dourado `#E8B04B` para "hoje" e prova; azul `#5AA9E6` corrida leve; âmbar `#E8934A` academia; vermelho `#E8654F` intervalado; verde `#4CAF82` longão e concluído; cinza `#5B6275` descanso. Números (pace, tempos, séries) em fonte monoespaçada. Ícones lucide. Cantos 12–14 px.
>
> **Telas:** (1) Entrada com PIN numérico; (2) Onboarding em 5 passos (perfil, recordes, disponibilidade semanal por dia com tempo máximo, preferências, conectar Strava); (3) **Hoje** com data de hoje em dourado, contagem regressiva da prova, fase do ciclo, cartão do treino do dia, semana em bolinhas, alerta do motor e botão "Estou doente / com dor"; (4) **Calendário** mensal com hoje destacado, ponto colorido por tipo de treino, painel do dia ao tocar e botão "Mover"; (5) **Treino do dia** de corrida (aquecimento, séries com ritmos, parciais importadas) e de academia (exercícios, séries com carga e repetições, "mesma carga da semana passada"); (6) **Provas** (lista e cadastro, com avaliação da meta: realista/ambiciosa/inviável); (7) **Proposta de ajuste** com motivo, o que muda (removido/movido/adicionado/reduzido), antes/depois e botões Aceitar/Recusar/Ajustar; (8) folha "Estou doente / com dor" com tipo, região, gravidade e sintomas, e aviso de que não é diagnóstico; (9) Histórico com selos de status; (10) Perfil com registro de peso; (11) Configurações e conexões (Strava).
>
> Navegação por barra inferior: Hoje, Calendário, Provas, Histórico, Mais. Desenhe estados de carregando, vazio, erro e offline. Use os dados de exemplo em anexo. **Código limpo, com componentes React reutilizáveis que recebam dados por props (sem buscar dados dentro do componente) e Tailwind**, para que eu ligue depois a uma API.

---

## 8. Como trazer o resultado de volta para cá

1. No Claude Design, quando a tela estiver boa, exporte como **HTML autônomo** e/ou **pasta** com os arquivos.
2. Suba os arquivos aqui na conversa. Eu leio, separo em componentes e ligo ao back-end (Server Actions e rotas da API).
3. O "pacote de handoff" do Claude Design foi pensado para o **Claude Code**; se preferir, o Claude Code pode fazer essa etapa de integração, e eu fico com as regras do motor e a API.
