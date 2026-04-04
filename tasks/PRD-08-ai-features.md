# PRD-08 — Funcionalidades de IA e Gestão de Cotas

**Projeto:** Nexus CMS  
**Módulo:** AI Features  
**Versão:** 1.0 | 2026-04-04  

---

## 1. Visão Geral

As funcionalidades de IA do Nexus CMS são **opcionais e controladas pelo Owner**. Nenhuma feature de IA funciona sem configuração explícita. O sistema foi projetado para manter controle total de custos e privacidade.

### Princípios

- **Opt-in obrigatório:** nenhuma IA ativa por padrão
- **Controle de custos:** cotas por usuário, visibilidade de consumo em tempo real
- **Privacidade:** conteúdo enviado à IA deve ser tratado conforme política de cada provedor
- **Degradação graciosa:** quando IA indisponível, a funcionalidade some silenciosamente (sem erros visíveis no blog público)

---

## 2. Ativação do Sistema de IA

### 2.1 Configuração pelo Owner

Fluxo de ativação:

```
[1] Owner acessa: Configurações → IA & Cotas
[2] Owner insere API Key do provedor (campo mascarado)
    → Providers suportados: OpenAI, Anthropic, e outros compatíveis
[3] Sistema valida a API Key (requisição de teste)
[4] Se válida: IA ativada no sistema → Owner pode agora habilitar por usuário
[5] Se inválida: mensagem de erro + a feature permanece desativada
```

### 2.2 Habilitação por Usuário

- Owner acessa o perfil do usuário (ou tela de IA & Cotas)
- Toggle "Habilitar IA para este usuário"
- Define cota mensal de tokens para o usuário (número inteiro positivo)
- Usuário recebe notificação de que IA foi ativada para sua conta
- Somente **Owner** pode habilitar ou desabilitar IA para usuários

### 2.3 Estado quando IA não está configurada

- Funcionalidades de IA ficam completamente ocultas da interface
- Tela "IA & Cotas" no painel exibe: "Configure uma API Key para ativar as funcionalidades de IA."
- Badge "Não configurado" junto à entrada no menu lateral
- Editor MDX: campo de autocomplete não aparece

---

## 3. Funcionalidades de IA

### 3.1 Ghost Writer — Autocomplete no Editor

Descrito em detalhe no [PRD-06-editor-mdx.md](PRD-06-editor-mdx.md) — seção 6.

**Resumo técnico:**
- Trigger: pausa de 1.5s na digitação
- Contexto: últimos 500 tokens + título + categoria + idioma
- Resposta: máx. 2 frases de continuação
- Interação: `Tab` aceita, `Esc` descarta
- Provider: API configurada pelo Owner (OpenAI GPT-4o, Claude, etc.)
- Tokens consumidos: deduzidos da cota do usuário em tempo real

---

### 3.2 Análise de Trends

**Objetivo:** Identificar quais tópicos estão em alta em uma categoria específica para guiar a criação de conteúdo.

**Acesso:** Painel Admin → IA & Cotas → Trends  
**Disponível para:** Usuários com IA habilitada

**Fluxo:**

1. Usuário seleciona uma categoria
2. Define janela de análise (últimos 7/30/90 dias)
3. Sistema analisa: posts da categoria, tags mais usadas, crescimento de views por tópico
4. IA processa os dados e gera um relatório:
   - Top 5 tópicos em crescimento
   - Tópicos com queda de engajamento
   - Sugestões de novos posts ("Gaps de conteúdo")
5. Resultado exibido como lista com scores e justificativas
6. Botão: "Criar post sobre este tópico" → abre editor com título pré-preenchido

**Tokens consumidos:** cobrados da cota do usuário.

---

### 3.3 Tradução Automática (EN)

**Objetivo:** Gerar a versão em inglês de um post já escrito em pt-BR.

**Acesso:** Editor MDX → Menu "IA" → "Traduzir para EN"  
**Disponível para:** Usuários com IA habilitada, ao editar um post em `pt-BR`

**Fluxo:**

1. Usuário clica em "Traduzir para EN" no editor
2. Modal de confirmação:
   - "Isso criará um novo rascunho em inglês vinculado a este post."
   - "Consumirá aproximadamente X tokens da sua cota."
   - Botões: "Traduzir" / "Cancelar"
3. Após confirmação:
   - Post atual salvo
   - IA processa a tradução completa (título, subtítulo, excerpt, conteúdo)
   - Novo rascunho criado com `lang: en`, `translationGroupId` vinculado ao original
4. Editor abre o rascunho traduzido para revisão humana
5. Aviso sempre visível: "Revise a tradução antes de publicar. IA pode cometer erros."

**Importante:** A tradução é um ponto de partida, não um produto final. O sistema incentiva revisão humana.

---

### 3.4 Gerador de Imagem

**Objetivo:** Criar imagens de capa ou ilustrações para posts diretamente no CMS.

**Acesso:** Biblioteca de Imagens → "Gerar com IA" | Editor MDX → toolbar → ícone de IA  
**Disponível para:** Usuários com IA habilitada

**Fluxo:**

1. Usuário abre o gerador de imagem
2. Preenche o prompt descritivo (ex: "Foto editorial minimalista de um laptop em mesa de madeira, iluminação suave, fundo escuro")
3. Seleciona proporção: 16:9 (cover), 1:1 (card), 9:16 (stories)
4. Seleciona estilo (opcional): Fotográfico, Ilustração, Abstrato
5. Clica em "Gerar"
6. Sistema exibe 4 variações
7. Usuário seleciona uma → imagem salva na Biblioteca de Imagens
8. Pode usar o crop tool antes de salvar
9. Alt text gerado automaticamente pelo sistema (editável pelo usuário)

**Tokens consumidos:** cobrados por geração (não por variação selecionada).

**Nota:** Imagens geradas por IA são marcadas com metadado `aiGenerated: true` para transparência.

---

## 4. Gestão de Cotas (Tela IA & Cotas — Owner)

### 4.1 Componentes da Tela

#### `ProviderConfig`
- Provedor ativo (dropdown: OpenAI, Anthropic, etc.)
- Campo de API Key (mascarado, `type="password"`)
- Botão "Testar conexão" — faz chamada mínima para validar
- Status: badge verde "Conectado" ou vermelho "Erro" com mensagem

#### `GlobalUsageOverview`
- Total de tokens consumidos no mês atual (todos os usuários)
- Custo estimado em USD (baseado na pricing do provedor — referência, não exato)
- Gráfico de barras: consumo por usuário nos últimos 30 dias

#### `UserQuotaTable`
- Tabela de usuários com IA habilitada:
  - Nome | Cota mensal | Tokens usados este mês | % utilizado | Ações
- Barra de progresso colorida: verde (<70%), amarelo (70-90%), vermelho (>90%)
- Ações: Editar cota, Desabilitar IA, Ver histórico de uso
- Botão "Habilitar IA para novo usuário" → seleção de usuário + definição de cota

#### `QuotaManager` (ao editar cota de um usuário)
- Slider ou input numérico para definir tokens mensais
- Preview: "Com esta cota, o usuário pode gerar aproximadamente X artigos de 1000 palavras."
- Toggle: ativar/desativar reset automático no dia 1 de cada mês
- Opção: cota não reinicia — consumo acumula (para controle mais rígido)

---

## 5. Visão do Usuário (Uso de IA no próprio perfil)

Usuários com IA habilitada veem no seu perfil:

- **Token Meter:** gráfico circular animado com uso atual vs. cota mensal
  - Centro: "X / Y tokens"
  - Cor: verde → amarelo → vermelho conforme aproxima do limite
- Histórico de uso: lista com data, funcionalidade usada, tokens consumidos
- Alerta quando atingir 80% da cota: notificação in-app + e-mail (configurável)
- Alerta quando atingir 100%: funcionalidades de IA desabilitadas + mensagem "Cota atingida. Contate o administrador."

---

## 6. Segurança e Privacidade das Integrações de IA

- API Keys armazenadas **criptografadas** no banco (AES-256)
- API Keys nunca retornadas em nenhuma API response (somente status: configurado/não configurado)
- Conteúdo enviado ao provedor de IA: responsabilidade do Owner (termos de uso do provedor se aplicam)
- Aviso visível nas configurações: "O conteúdo enviado para geração de IA é processado pelo provedor configurado. Consulte a política de privacidade do provedor."
- Logs de uso (tokens, funcionalidade, data) armazenados localmente — sem envio para terceiros
