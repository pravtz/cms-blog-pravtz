
- Blog com um painel administrativo
- Posts em MDX
- Editor markdown
- Frontmatter: title, subtitulo, date, tags, categoria, excerpt, coverImage (opcional), visibility (public, iPrivate, allPrivate, groupPrivate, listPrivate )
- Terão artigos (conteudo do blog) que poderão ser visualizado pelo publico em geral (public), só os usuários cadastrasdos (allPrivate) , listas de usuários (listPrivate), grupos pré definidos (groupPrivate), ou somente para mim (iPrivate)
- Página home com bio curta + posts recentes
- Página /blog com todos os posts um campo de busca e filtro por data, tag e categorias
- Página /blog/[slug] com o post
- Dark mode
- Design minimalista
- painel administrativo para adicionar os posts
- sqlite com a possibilidade de migração para um banco postgre para persistir os dados
- utilize mas melhores técnicas de SEO
- o blog vai conter uma api publica (somente get dos posts) para os posts
- a api do blog vai conter uma rate limit por segurança
- as imagens iram ficar em um s3 da aws ou um storage da azure
- o pagina web publico vai ser statica e publicada em um recurso statico
- a pagina do administrativo vai estar em um servidor
- a api vai seguir as boas praticas de desenvolvimento como padroes de projetos e arquitetura
- integração com a ferramenta Microsoft Clarity
- a segurança será o item mais importantes
- testes de integração, testes unitarios e testes e2e estarão entre cada feacture para validar
- design deve seguir e garantir que a acessibilidade vai obedecer
- os postes poderão ter a versão em outros idiomas (EN, PT-br), quando existir um post em outro idioma o usuario podera alterar a sua visualização
- na pagina dos slug, acima do rodape vai ter os três postes da mesma categoria e um campo para se escrever na newsletter (cuidar a segurança e respeitar a privacidade, o usuario deve ativar um check que autoriza receber email, deve receber um email de confirmação com token de acesso)
- os comentarios teram a opção de like (positivo e negativo)
- icones e imagens em vetor devem ser priorizados 
- o objetivo é ser opensorce

## intalação
- vai ser em docker
- o primeiro acesso ao painel administrativo usuario vai precisar cadastrar o usuario awner, email e senha e o banco que vai persistir;
- o nome do blog e o logo devem ser adicionados apos a instalação e no primeiro acesso (o logo pode ser opcional)
- a documentação das boas praticas deve ser recomendada

## Cadastro de usuario
- o usuario so precisa cadastrar um nome completo, aplelido, email e telefone
- a foto(avatar) é opcional
- o usuário que não esta no grupo de permissões default,  vai poder colocar o link do seu github, instagran, linkedin, facebook e sua bio 
- o primeiro acesso do usuario (exceto o usuario default), deve dizer qual categoria de assunto que ele tem mais interesse
- os usuario cadastrados devem receber o email de confirmação e ativar com um token de segurança

## Paineis
- Blog (web acesso ao publico)
- Painel administrativo (so usuarios cadastrados)

## o card do post vai conter:
- titulo, subtitulo, data, imagem, numero de view, número de comentarios link e botão para compartilhar compartilhar (o like e a ação de compartilhar só será possivel se o usuario for cadastrado, mas o a quantidade pode ser visualizada)
- ao clicar no link, será possivel escolher entre compartilhar no whatssap, instagran, linkedin ou link
- a categorias de forma sutiu
- o card terá claro e minimalista
- vai serguir o design system
- linhas suaves e cantos levemente arredondados
- uma borda de espesura minimalista
- deve seguir o design system

## a página de principal vai conter
- o destaque da página principal e ultimo blog
- os 12 ultimos na hordem de mais vistos
- pagina


## o painel administrativo do blog vai conter:
- tera notificações importantes
- Grafico das principais metricas de SEO no dashboar do 
- tela de crud de usuario
- tela de crud de grupo do usuários (por padrão, os grupos owner, e defult não poderão ser deletados ou modificados)
- um usuario pode participar de mais de um grupo
- tela para alterar permissões de usuários ou grupos (nessa tela sera possivel restringir o acesso as telas ou a operações do crud (create, reader, update ou delete), crie checkbox de forma humanizada para grupos ou membros)
- os membros administrativos (que tiverem permissão de adicionar outros usuario poderão aceitar o cadastro e selecionar as suas permissõees) receberão uma notificação quando um novo usuario se cadastrar;
- o usuário cadastrado não terá acesso ao painel até que um administrador de o aceite, 
- enquanto o administrador não der o aceite, o usuario só ira receber no login que ele não tem acesso até que o administrador aceite (mesmo sendo um usuario default)
- sómente o usuário owner pode permitir um usuario a ser administrador e ativar funcionalidades de IA para os usuarios
- o usuario owner terá acesso total e inrrestrito, pode ter até 10 usuarios owner;
- o usuario default (default) só ira poder dar like, compartilhar e comentar um artigo (o usuario default não tera acesso ao painel administrativo mas vai poder logar)
- gestão de permissão de usuario
- o usuario (exceto usuario default) poderá adicionar sua foto e a sua bio
- tela para ver o conteudo que o usuario mais cosumiu, uma lista com links dos comentarios, quantidade de likes e quantidade de conteudos compartilhados
- tela de crud de tags
- tela de crud de categorias
- tela de crud de posts (artigos)
- tela de crud de comentarios (os comentarios erdam as mesmas permissoes de visualização do post)
- cada tela de crud vai ter um campo de busca
- tela de crud de imagens (upload das imagens com possibilidade de cortar a imagem, as imagem seguiram as boas praticas de SEO e acessibilidade)
- tela de crud de rascunhos dos posts
- lista de usuarios cadastrados na newsletter
- tela de email marketing ( por default estara desativada, exceto se for configurada)
- tera uma tela de configuração do dominio entre outras configurações necessarias para o email marketing
- Gerador de card em png para as midias solicia (cria cards do blog em questão com os formatos das midias sociais)
- tela de crud de ideias pessoais com uma nota de 0-10 para potuar as melhores ideas ( essa tela poderá ter lista de pessoas que iram compartilhar)
- Página de documentaçao de uso do sistema (a documentação sera atualizada a cada release, as documentações podem ser editadas pelo administrador)
- vai poder ter integrações de notificações com o Team, slack e discord, email
- tera uma tela de configurações das integrações de notificações
- a versão do sistema ficara no rodape do menu e ele vai associar a atual release
- terá uma tela para visualizar as metricas com mais detalhes e os messes anterioes e a tendencia, sendo essas metricas importantes para analizar a adesão seguindo as boas praticas de SEO
- sera possivel exportar um resumo dessas metricas com algum usuario via email ou link de notificação 
- terá uma tela de release
- tera uma tela de configuração de redes sociais, e quando possivel a sua integração com a redes sociais
- variaveis senciveis (tokens, secreats) serão adicionadas pelo owner, (enquanto não for adicinada a funcionalidade não ira ser adicionada)
- a funcionalidade de IA será ativa se o owner ativar, ele vai poder determinar quais usuarios poderão utilizar
- quando o usuario tiver permissão vai poder ver o quanto de token gastou e sua cota máxima de uso
- o owner vai poder dar cotas de uso para cada o usuario com ativação para uso da IA
- quando o owner colocar a apikey a opção de uso da IA será Ativada
- pagina do C4 model para mostrar a arquitetura utilizada
- a cada feacture ou release o codigo do c4 model podera ser atualizado
- todos os componentes utilizados estaram no storebook
- o MCP podera ser utilizado para as novas feactures
- uma pagina estatica para o storebook

## Funcionalidades de IA
- as funcionalidades de trends (ver quais conteudos estão mais em alta dentro de uma categoria especifica)
- sugestões de postes  com auto-complete (com tab) em cada segmento de escrita do editor dos posts
- gerador de imagem
- gerador de posts em idioma EN


## tetalhes do design
web application/stitch/projects/2358177421380584444/screens/ebcba4d545934f2695756c4654027c62
# PRD Mestre Detalhado: Nexus CMS - "The Editorial Monograph"

## 1. Visão Geral e Posicionamento
e um sistema de gerenciamento de conteúdo open-source projetado para criadores que valorizam a estética editorial, segurança e inteligência artificial. Ele se posiciona entre a simplicidade do Ghost e a robustez, com um foco implacável em tipografia e performance.

## 2. Design System & Identidade Visual
- **Conceito:** "Ink & Steel" (Nanquim e Aço). Uma mistura de tradição editorial com modernidade tecnológica.
- **Tipografia Principal:** 
  - *Serif:* **Newsreader** (Títulos e corpo de texto longo). Proporciona legibilidade excepcional e tom acadêmico/sofisticado.
  - *Sans-Serif:* **Inter** (Interface, botões, labels). Foco em clareza funcional.
- **Variações de Temas (Acessibilidade 4.5:1+):**
  1. **Onyx (Default):** Fundo #060e20, Destaque #c0c1ff (Lavanda).
  2. **Emerald:** Fundo #061a15, Destaque #34d399 (Esmeralda).
  3. **Crimson:** Fundo #1a0606, Destaque #f87171 (Coral).
  4. **Slate:** Fundo #0f172a, Destaque #38bdf8 (Céu).
  5. **Amber:** Fundo #1a1206, Destaque #fbbf24 (Âmbar).
  6. **Rose:** Fundo #1a0614, Destaque #f472b6 (Rosa).
  7. **Violet:** Fundo #13061a, Destaque #a78bfa (Violeta).

## 3. Especificação Detalhada das Telas

### 3.1 Página Inicial (Home) - Publica
- **Objetivo:** Captura imediata do leitor e navegação rápida pelos tópicos mais quentes.
- **Componentes:**
  - `Hero Spotlight`: O post mais recente com imagem de alta resolução e tipografia gigante.
  - `Top 12 Grid`: Mosaico de posts ordenados por engajamento/views. Cada card exibe: Título, Autor, Data, Categoria (sutil) e Ações (Share/Like para logados).
  - `Short Bio`: Seção flutuante ou lateral com a biografia do Owner e links sociais.
- **Interações:** Scroll infinito suave ou botão "Load More" com skeleton screen.

### 3.2 Feed do Blog (/blog) - Publica
- **Objetivo:** Exploração profunda do arquivo.
- **Componentes:**
  - `Sticky Filter Bar`: Filtros por Tags, Categorias e Data (Year/Month).
  - `Search Interface`: Input com autocomplete inteligente sugerindo posts e autores.
  - `Editorial List`: Cards verticais que priorizam o título e o excerto (excerpt).
- **SEO:** URLs amigáveis, sitemaps dinâmicos e Meta JSON-LD para cada categoria.

### 3.3 Leitura do Post (/blog/[slug]) - Publica/Restrita
- **Objetivo:** Foco absoluto na leitura (Reading Experience).
- **Componentes:**
  - `Floating Progress Bar`: Indica quanto falta para terminar a leitura.
  - `MDX Renderer`: Suporte a blocos de código com syntax highlighting, tabelas complexas e citações (blockquotes) estilizadas.
  - `RBAC Banner`: Se o post for restrito, exibe um blur no conteúdo e um CTA de login/cadastro.
  - `Newsletter Lock`: Card de inscrição antes do rodapé com Checkbox de Privacidade obrigatório.
  - `Comment Thread`: Suporte a threads de discussão com votação positiva/negativa.

### 3.4 Painel Administrativo (Dashboard) - Restrito
- **Objetivo:** Gestão estratégica e operacional.
- **Componentes:**
  - `Dynamic Sidebar`: 
    - *Desktop:* Largura fixa (280px) reduzida para ícones (64px) via botão manual. Expande ao passar o mouse (hover) se estiver colapsada.
    - *Mobile:* Drawer deslizante.
  - `Analytics Cards`: Gráficos Sparkline para SEO Score, Engagement Rate e Unique Visitors.
  - `Quick Entry Button`: Botão de destaque flutuante para criar novo post.

### 3.5 Editor MDX - Restrito
- **Objetivo:** Escrita sem distrações com assistência de IA.
- **Componentes:**
  - `Split View`: Escrita à esquerda, preview renderizado à direita.
  - `Frontmatter Inspector`: Painel lateral para metadados (Visibility, Tags, Cover).
  - `AI Ghost Writer`: Sugestões de texto via Tab integrando com a API Key do Owner.

### 3.6 Gestão de Permissões (RBAC) - Restrito (Owner/Admin)
- **Objetivo:** Controle total de segurança.
- **Componentes:**
  - `Access Matrix`: Grid de checkboxes humanizados (ex: "Pode editar posts de outros?", "Pode ver métricas financeiras?").
  - `User Audit Trail`: Log de quem alterou o quê e quando.

### 3.7 Configurações de IA & Cotas - Restrito (Owner)
- **Objetivo:** Controle de custos e limites.
- **Componentes:**
  - `Token Meter`: Gráfico circular mostrando uso atual vs. cota mensal.
  - `Provider Config`: Inputs para OpenAI, Anthropic, etc.

## 4. Requisitos Não-Funcionais e Segurança
- **Performance:** Imagens servidas via S3 com WebP/AVIF. Cache via Redis para queries do SQLite/Postgres.
- **Segurança:** Autenticação JWT com Refresh Tokens. Rate limit agressivo na API pública. Sanitização rigorosa de MDX para evitar XSS.
- **Acessibilidade:** Conformidade WCAG 2.1 AA. Suporte nativo a navegação por tabulação e leitores de tela (ARIA labels em todos os controles).


## 1. Visão Geral
Um CMS minimalista e robusto focado em segurança, SEO, acessibilidade e funcionalidades de IA, projetado para ser open-source e rodar em infraestrutura moderna).

## 2. Arquitetura e Tech Stack
- **Frontend Público:** Estático (SSG), focado em performance e SEO.
- **Painel Administrativo:** Server-side, autenticado.
- **Banco de Dados:** SQLite (default) com suporte a migração para PostgreSQL.
- **Armazenamento:** AWS S3 ou Azure Blob Storage.
- **Segurança:** Rate limiting na API, autenticação JWT/Session, tokens de confirmação por e-mail.
- **Infraestrutura:** Dockerizado.
- **Observabilidade:** Integração com Microsoft Clarity.
- **Documentação Técnica:** C4 Model integrado e Storybook para componentes.

## 3. Funcionalidades Principais (Core)

### 3.1 Gestão de Conteúdo (Blog)
- **Editor Markdown/MDX:** Suporte a Frontmatter completo (title, date, tags, category, excerpt, coverImage, visibility).
- **Visibilidade Granular:** Public, iPrivate, allPrivate, groupPrivate, listPrivate.
- **Multilinguagem:** Suporte nativo a EN e PT-BR com troca rápida de idioma.
- **Comentários:** Sistema de Likes (Positivo/Negativo) e moderação.
- **Newsletter:** Opt-in com confirmação de e-mail (Double Opt-in) e token de segurança.

### 3.2 Painel Administrativo
- **Dashboard de Métricas:** Gráficos de SEO e engajamento.
- **Gestão de Usuários e Grupos:** Sistema de permissões RBAC (Owner, Default, Custom).
- **Owner Privileges:** Controle total, gestão de API Keys de IA e cotas de uso.
- **Notificações:** Integração com Teams, Slack, Discord e E-mail.
- **Gerador de Assets:** Criação de cards sociais em PNG a partir dos posts.
- **Gestão de Ideias:** Sistema de notas (0-10) para brainstorming de posts.

### 3.3 Inteligência Artificial
- **Assistência na Escrita:** Autocomplete (Tab) e sugestões por segmento.
- **Trends:** Análise de tópicos em alta por categoria.
- **Multimodal:** Geração de imagens e tradução automática para EN.

## 4. Design & UX
- **Estilo:** Minimalista, "claro e limpo", linhas suaves, cantos levemente arredondados.
- **Acessibilidade:** Conformidade com padrões WCAG.
- **Modo:** Dark Mode nativo.
- **Componentes:** Foco em ícones e imagens vetoriais.

## 5. Fluxo de Instalação (First Run)
1. Setup via Docker.
2. Cadastro do primeiro usuário (Owner).
3. Configuração do banco de dados e credenciais de e-mail.
4. Definição do nome do blog e upload opcional de logo.

web application/stitch/projects/2358177421380584444/screens/0caf9161b760427cb80ec69c878f4ed3


## 1. Detalhamento das Telas Existentes

### 1.1 Página Inicial (Home)
- **Componentes:**
    - `HeroSection`: Destaque do post mais recente ou "Editor's Choice".
    - `BioCard`: Pequena seção lateral/superior com foto do owner e breve descrição.
    - `PostGrid`: Lista dos 12 posts mais vistos (ordenados por views).
    - `LoadMoreButton`: Gatilho para carregar o arquivo completo.
- **Interações:** Hover suave nos cards, transição de opacidade no carregamento.

### 1.2 Feed do Blog (/blog)
- **Componentes:**
    - `SearchBar`: Campo flutuante com sugestões em tempo real.
    - `FilterBar`: Filtros por Categoria, Tags e Data (Mês/Ano).
    - `PostCardList`: Layout vertical otimizado para leitura rápida de títulos e excerpts.
- **SEO:** H1 dinâmico baseado no filtro aplicado, Meta tags de listagem.

### 1.3 Painel Administrativo (Dashboard)
- **Componentes:**
    - `MetricCard`: Exibição de SEO, Engajamento e Views com mini-gráficos (Sparklines).
    - `ActivityFeed`: Lista de eventos recentes (novos usuários, falhas de login).
    - `QuickActions`: Botões flutuantes para "Novo Post", "Gerir Usuários".

### 1.4 Editor MDX
- **Componentes:**
    - `FrontmatterDrawer`: Painel lateral para configurar Title, Visibility, Cover Image.
    - `MarkdownToolbar`: Atalhos para B, I, Links, Imagens e Code Blocks.
    - `AIAutocomplete`: Sugestões de texto via Tab (Ghost Text).

---

## 2. Novas Telas (A Serem Implementadas)

### 2.1 Página de Leitura (/blog/[slug])
- **Objetivo:** Experiência de leitura imersiva.
- **Componentes:**
    - `ArticleHeader`: Imagem de capa, Título, Subtítulo e Metadados (Autor, Data, Tempo de leitura).
    - `MDXContent`: Renderizador de Markdown estilizado (Typography focus).
    - `RecommendationSection`: "Posts da mesma categoria" acima do rodapé.
    - `NewsletterCard`: Campo de e-mail com Checkbox de Privacidade (Double Opt-in).
    - `CommentSystem`: Lista de comentários com sistema de Like/Dislike (Positivo/Negativo).

### 2.2 Gestão de Permissões (RBAC)
- **Objetivo:** Controle granular de acesso.
- **Componentes:**
    - `PermissionTable`: Checkbox humanizados para Create, Read, Update, Delete.
    - `GroupManager`: Interface para criar grupos (ex: Editores, Moderadores).
    - `UserApprovalList`: Lista de usuários pendentes de aceite do administrador.

### 2.3 Configurações de IA & Cotas
- **Objetivo:** Gestão de custos e acesso a IA pelo Owner.
- **Componentes:**
    - `APIKeyField`: Input mascarado para chaves (OpenAI, etc).
    - `UsageTracker`: Gráficos de consumo de tokens por usuário.
    - `QuotaManager`: Slider para definir limite de tokens por nível de permissão.

---

## 3. Padrões de Design e Acessibilidade
- **Cores:** Fundo `#060e20` (Nexus Dark), Destaque `#c0c1ff`.
- **Tipografia:** Serif para títulos (Newsreader), Sans para corpo (Inter/Roboto).
- **Acessibilidade:** Contrast ratio 4.5:1 mín, suporte a navegação por teclado em todos os forms.
