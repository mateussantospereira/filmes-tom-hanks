// ============================================================
//  P1 — Relatório bimestral de atividades (entrega INDIVIDUAL)
//  ISW055 · Introdução à Computação em Nuvem · Fatec Pompeia · 2026.2
//
//  Compilar: typst compile P1_ISW055_template.typ
//  Saída:    P1_ISW055_Mateus_dos_Santos_Pereira.pdf (renomear para docs/)
// ============================================================

// ---------- DADOS DO ALUNO ----------
#let aluno = "Mateus dos Santos Pereira"
#let turma = "161_SIST. INTELIGENTES_N"
#let data-relatorio = "07/10/2026"

// ---------- daqui pra baixo, só mexa nas fichas de atividade ----------
#let disciplina = "Introdução à Computação em Nuvem"
#let codigo = "ISW055"
#let professor = "Prof. Allan Lincoln Rodrigues Siriani"
#let accent = rgb("#b96f1f")

#set document(title: "P1 — " + codigo + " — " + aluno, author: aluno)
#set page(paper: "a4", margin: (top: 2.5cm, bottom: 2.5cm, left: 2.5cm, right: 2cm))
#set text(size: 11pt, lang: "pt", region: "BR")
#set par(justify: true, leading: 0.7em)
#set heading(numbering: "1.1")
#show heading.where(level: 1): it => { v(0.6em); text(size: 16pt, it); v(0.2em) }
#show heading.where(level: 2): it => { v(0.5em); text(size: 13pt, it); v(0.1em) }
#show link: set text(fill: accent)
#show figure.caption: set text(size: 9pt, fill: luma(90))
#set table(stroke: 0.5pt + luma(200), inset: 6pt)
#show table: set text(hyphenate: false)
#show table: set par(justify: false)

// ---------- ajudantes ----------
#let evidencia(legenda, arquivo: none) = figure(
  if arquivo == none {
    rect(width: 100%, height: 5.5cm, radius: 4pt, stroke: (paint: luma(170), dash: "dashed"))[
      #align(center + horizon)[
        #text(fill: luma(130), size: 9.5pt)[
          print pendente — insira `arquivo: "prints/..."` na ficha da atividade 1
        ]
      ]
    ]
  } else {
    image(arquivo, width: 100%)
  },
  kind: image,
  supplement: [Figura],
  caption: legenda,
)

#let registro = state("registro", ())

#let atividade(
  numero, titulo,
  descricao: "",
  planejada: "",
  realizada: "—",
  situacao: "entregue",   // entregue · entregue com atraso · não entregue
  evidencia: "",
  url: "",
  corpo,
) = {
  registro.update(l => l + ((
    numero: numero, titulo: titulo, descricao: descricao,
    planejada: planejada, realizada: realizada, situacao: situacao,
  ),))
  heading(level: 2, [Atividade #numero — #titulo])
  table(
    columns: (3.4cm, 1fr),
    fill: (x, y) => if x == 0 { luma(245) } else { none },
    [*Descrição*], [#descricao],
    [*Data planejada*], [#planejada],
    [*Data realizada*], [#realizada],
    [*Situação*], [#situacao],
    [*Evidência*], [#evidencia],
    [*Link*], [#if url == "" [—] else [#link(url)]],
  )
  corpo
}

// ============================================================
//  CAPA
// ============================================================
#align(center)[
  #v(2.5cm)
  #text(size: 12pt, tracking: 0.12em)[FATEC POMPEIA]
  #v(0.4em)
  #text(size: 10.5pt, fill: luma(110))[#disciplina · #codigo · #turma]
  #v(4.5cm)
  #text(size: 26pt, weight: "bold")[P1]
  #v(0.3em)
  #text(size: 18pt, weight: "bold")[Relatório bimestral de atividades]
  #v(0.8em)
  #text(size: 11pt, fill: luma(110))[Avaliação individual · 2026.2]
  #v(5cm)
  #text(size: 14pt)[#aluno]
  #v(1fr)
  #text(size: 10.5pt)[#professor \ Pompeia, #data-relatorio]
]

#set page(
  numbering: "1",
  number-align: right,
  header: context {
    set text(size: 8pt, fill: luma(120))
    [#codigo · P1 — Relatório bimestral #h(1fr) #aluno]
    line(length: 100%, stroke: 0.4pt + luma(200))
  },
)
#counter(page).update(1)

#outline(title: "Sumário", indent: 1.2em, depth: 2)
#pagebreak()

// ============================================================
= Introdução
// ============================================================
A disciplina ISW055 — *Introdução à Computação em Nuvem*, do curso de Tecnologia em Sistemas Inteligentes da Fatec Pompeia, apresenta os fundamentos de desenvolvimento e operação de sistemas distribuídos: microsserviços, contêineres, armazenamento de objetos, autenticação, controle de acesso e observabilidade. O fio condutor do bimestre foi um único projeto que cresceu semana a semana: um catálogo de filmes do ator Tom Hanks, iniciado como uma aplicação simples e evoluído até um sistema composto por vários serviços rodando em contêineres.

Durante o período foram realizadas seis atividades, começando por um nivelamento em sala (agenda telefônica em Flask) e o próprio catálogo com consumo da API do TMDb e persistência em MariaDB. Em seguida o login foi desacoplado em um microsserviço de autenticação, o controle de acesso foi endurecido com um modelo de permissões por papel (RBAC), foram adicionados logs e auditoria com Redis Streams e, por fim, o perfil do usuário ganhou upload de foto armazenada no MinIO. Todo o código está versionado em um único repositório público no GitHub, publicado também em um ambiente de produção via Docker Compose.

Este relatório presta contas desse período: apresenta a metodologia usada, um quadro com a data planejada e a data realizada de cada atividade, uma ficha detalhada por entrega com evidências verificáveis (commit, data e hora, e print do resultado) e, ao final, as considerações sobre o que foi aprendido e o que seria feito diferente. O objetivo é documentar, com rastreabilidade e honestidade, o que foi construído e comprovado ao longo do bimestre.

// ============================================================
= Metodologia
// ============================================================
Todas as atividades foram desenvolvidas no mesmo repositório público do GitHub (`mateussantospereira/filmes-tom-hanks`), como continuação de um único projeto. O ambiente de desenvolvimento usou Bun como runtime, o framework Hono para as APIs, MariaDB como banco relacional, Docker Compose para orquestração local e Portainer para o deploy em produção; o armazenamento de arquivos ficou no MinIO e os logs de auditoria no Redis, consumidos por um serviço dedicado de logs. Cada atividade foi implementada, testada localmente e, quando aplicável, publicada no ambiente de produção usado para as demonstrações.

A data e a hora de cada entrega foram extraídas do histórico de commits do repositório com `git log --format="%h %ad"` (formato DD/MM/AAAA HH:MM) e conferidas na página do commit no GitHub. Para cada atividade, o relatório traz duas evidências complementares: um print de terminal com o comando `git log` (hash, data/hora e repositório) e a captura da página do commit no GitHub; além do print do resultado do sistema em execução. Os serviços são públicos em `https://mateus-pereira-isw055.lapps.studio`, e o README do repositório documenta cada atividade e menciona o professor (`github.com/siriani`).

// ============================================================
= Quadro de entregas
// ============================================================
#context {
  let l = registro.final()
  table(
    columns: (auto, 1.4fr, 2fr, 2.6cm, 2.9cm, 2.3cm),
    align: (center, left, left, center, center, center),
    fill: (x, y) => if y == 0 { luma(235) } else { none },
    table.header([*Nº*], [*Atividade*], [*Descrição*], [*Data \ planejada*], [*Data \ realizada*], [*Situação*]),
    ..l.map(a => (
      [#a.numero], [#a.titulo], [#text(size: 9pt)[#a.descricao]],
      [#a.planejada], [#a.realizada], [#a.situacao],
    )).flatten()
  )
}

// ============================================================
= Atividades realizadas
// ============================================================
#atividade(
  "1", "Agenda telefônica em Flask",
  descricao: "Nivelamento em sala: sistema monolítico Flask + Jinja com persistência leve no navegador (localStorage).",
  planejada: "07/08/2026",
  realizada: "07/08/2026 (em sala)",
  situacao: "entregue",
  evidencia: "Realizada em sala — print do sistema rodando localmente",
  url: "",
)[
  *O que foi feito.* A primeira atividade foi um nivelamento em sala de aula: uma agenda telefônica simples em Flask com templates Jinja, permitindo cadastrar, listar, editar e remover contatos. Como era um exercício de ambientação, a persistência foi mantida propositalmente leve — sem banco de dados, os contatos eram guardados no `localStorage` do navegador. O objetivo era familiarizar a turma com o padrão rota → função → template e com o loop de edição/execução em Python antes de começar o projeto principal.

  #evidencia([Atividade 1 — evidência da entrega (print do sistema rodando — pendente)])

  *Dificuldades e como foram resolvidas.* Por ser um nivelamento, não houve dificuldade técnica relevante; o código não foi versionado no GitHub na ocasião, apenas executado em sala. O print de comprovação do sistema rodando ficou pendente e será anexado a esta ficha assim que recuperado.
]

#atividade(
  "2", "Catálogo de filmes — Tom Hanks",
  descricao: "Consumo da API TMDB, persistência em MariaDB e segregação por usuário.",
  planejada: "20/08/2026",
  realizada: "18/08/2026 17:48",
  situacao: "entregue",
  evidencia: "GitHub — commit + README + print do catálogo",
  url: "https://github.com/mateussantospereira/filmes-tom-hanks/commit/c795793",
)[
  *O que foi feito.* Foi criado o repositório do projeto e o catálogo de filmes do Tom Hanks: a aplicação consome a API do TMDb para buscar e listar os filmes do ator, persiste os dados no MariaDB e oferece uma área logada em que cada usuário tem seus próprios favoritos (segregação por usuário). O docker-compose foi montado para rodar aplicação e banco juntos, com deploy via Portainer. O README documenta a arquitetura, o uso e o endereço de produção, e menciona o professor.

  #evidencia([Atividade 2 — evidência: commit `c795793` (terminal, 18/08/2026 17:48)], arquivo: "prints/evidencia-atv2-terminal.png")
  #evidencia([Atividade 2 — evidência: página do commit no GitHub], arquivo: "prints/evidencia-atv2-commit.png")
  #evidencia([Atividade 2 — resultado: catálogo logado em produção], arquivo: "prints/resultado-atv2-catalogo.png")

  *Dificuldades e como foram resolvidas.* A primeira montagem do ambiente (binários, dependências e rede do Docker) consumiu ajustes no Dockerfile; a solução foi isolar o lockfile e o compose em commits dedicados para o build ficar determinístico e reproduzível no Portainer.
]

#atividade(
  "3", "Desacoplando o login — microsserviço de autenticação",
  descricao: "Login, cadastro e esqueci-minha-senha num serviço à parte na rede interna do Docker.",
  planejada: "28/08/2026",
  realizada: "25/09/2026 16:21",
  situacao: "entregue com atraso",
  evidencia: "GitHub — commit + docker-compose.yml + print do login funcionando",
  url: "https://github.com/mateussantospereira/filmes-tom-hanks/commit/d08ced9",
)[
  *O que foi feito.* A autenticação foi extraída do catálogo para um serviço à parte (`auth-service`), que passou a ser o único dono da tabela de usuários e da lógica de senha, JWT e papel. O catálogo virou um gateway: as rotas de login, cadastro, `esqueci minha senha` e `reset` repassam a chamada ao auth-service pela rede interna do Docker (`AUTH_SERVICE_URL`). O fluxo de recuperação de senha envia um e-mail real via Mailtrap, e o docker-compose.yml documenta os dois serviços e suas dependências.

  #evidencia([Atividade 3 — evidência: commit `d08ced9` (terminal, 25/09/2026 16:21)], arquivo: "prints/evidencia-atv3-terminal.png")
  #evidencia([Atividade 3 — evidência: página do commit no GitHub], arquivo: "prints/evidencia-atv3-commit.png")
  #evidencia([Atividade 3 — resultado: tela de login em produção], arquivo: "prints/resultado-atv3-login.png")
  #evidencia([Atividade 3 — resultado: e-mail de recuperação de senha (Mailtrap)], arquivo: "prints/resultado-atv3-mailtrap.png")
  #evidencia([Atividade 3 — resultado: fluxo de redefinição de senha], arquivo: "prints/resultado-atv3-recuperacao.png")

  *Dificuldades e como foram resolvidas.* Sincronizar dois serviços em uma rede interna sem expor o auth-service para fora exigiu cuidar da variável `AUTH_SERVICE_URL` (nome do serviço, não `localhost`) e de timeouts para não segurar requisições do usuário com o serviço travado. O ajuste fino dos defaults de produção e das dependências (`mysql2`) foi concluído na semana seguinte à implementação principal, o que atrasou a entrega em relação à data planejada.
]

#atividade(
  "4", "Controle de acesso por papel — RBAC",
  descricao: "O campo role passa a decidir permissões reais no backend (403 para usuário comum).",
  planejada: "04/09/2026",
  realizada: "06/10/2026 11:18",
  situacao: "entregue com atraso",
  evidencia: "GitHub — commit + print do 403 e da ação de admin",
  url: "https://github.com/mateussantospereira/filmes-tom-hanks/commit/d83b05d",
)[
  *O que foi feito.* O campo `role` deixou de ser decorativo e passou a decidir permissões no servidor: foi criado um mapa explícito de permissões (`auth-service/src/auth/permissoes.ts`), com `admin` como superconjunto de `usuario` e decisão sempre *fail-closed*. `GET /me` devolve as permissões resolvidas, e o catálogo verifica `permissoes.includes(...)` em vez de comparar `role === "admin"`. Ações exclusivas de admin (apagar comentário de terceiro, listar usuários, alterar papel) negam com 403 para usuário comum; um bug de XSS armazenado em comentários também foi corrigido trocando `innerHTML` por `textContent`.

  #evidencia([Atividade 4 — evidência: commit `d83b05d` (terminal, 06/10/2026 11:18)], arquivo: "prints/evidencia-atv4-terminal.png")
  #evidencia([Atividade 4 — evidência: página do commit no GitHub], arquivo: "prints/evidencia-atv4-commit.png")
  #evidencia([Atividade 4 — resultado: 403 para usuário comum], arquivo: "prints/resultado-atv4-rbac-403.png")
  #evidencia([Atividade 4 — resultado: a mesma ação autorizada para admin], arquivo: "prints/resultado-atv4-rbac-admin.png")

  *Dificuldades e como foram resolvidas.* A entrega acumulou atraso por ter sido desenvolvida junto com a montagem das outras atividades. A principal dificuldade técnica foi provar a regra dos dois lados: a demonstração usa uma terceira conta como alvo, para que a exclusão pelo admin aconteça por *permissão* e não por *ownership*. O XSS armazenado foi descoberto durante a revisão do frontend e corrigido antes da entrega.
]

#atividade(
  "5", "Logs e auditoria",
  descricao: "Novo log-service com Redis registrando login, ações sensíveis e tentativas negadas.",
  planejada: "25/09/2026",
  realizada: "06/10/2026 18:30",
  situacao: "entregue com atraso",
  evidencia: "GitHub — commit + print da consulta de logs pelo admin",
  url: "https://github.com/mateussantospereira/filmes-tom-hanks/commit/dca3a82",
)[
  *O que foi feito.* Foi criado um serviço dedicado de logs (`log-service`) que consome eventos de um Redis Streams e os disponibiliza para consulta: login bem-sucedido, ações sensíveis (como troca de papel) e tentativas negadas com 403. Um middleware global de auditoria captura qualquer `acao_negada` na borda do catálogo e a publica no stream; o admin consulta os eventos pela interface de auditoria do sistema. Nas atividades seguintes o mesmo mecanismo passou a registrar também `upload_foto` e `editar_perfil`.

  #evidencia([Atividade 5 — evidência: commit `dca3a82` (terminal, 06/10/2026 18:30)], arquivo: "prints/evidencia-atv5-terminal.png")
  #evidencia([Atividade 5 — evidência: página do commit no GitHub], arquivo: "prints/evidencia-atv5-commit.png")
  #evidencia([Atividade 5 — resultado: consulta dos logs de auditoria pelo admin], arquivo: "prints/resultado-atv5-auditoria.png")

  *Dificuldades e como foram resolvidas.* O Redis e o log-service não persistem volume, então o stream de auditoria zera a cada redeploy — comportamento esperado e documentado, mas que exigiu a demonstração ser rodada contra o ambiente com os serviços ativos. Também foi necessário versionar os estáticos (`?v=`) para o cache do CDN não servir script antigo.
]

#atividade(
  "6", "Upload e perfil de usuário",
  descricao: "Página de perfil com avatar no MinIO; só a referência fica no banco relacional.",
  planejada: "02/10/2026",
  realizada: "06/10/2026 19:50",
  situacao: "entregue com atraso",
  evidencia: "GitHub — commit + print do perfil com foto",
  url: "https://github.com/mateussantospereira/filmes-tom-hanks/commit/01caeb5",
)[
  *O que foi feito.* A página de perfil do usuário ganhou bio e foto: o arquivo enviado vai para o bucket privado `perfis` do MinIO (com volume persistente no compose), a referência fica no MariaDB e a foto volta ao navegador por uma rota autenticada do catálogo (`GET /api/perfil/:id/foto`). O upload é validado no servidor (apenas imagem — 415; máximo 2 MB — 413). A identidade vem do token, nunca do ID no corpo/URL: editar ou fotografar o perfil de outra pessoa devolve 403 (`permissao_exigida: "editar:perfil-proprio"`), e esse evento entra na auditoria como `acao_negada`.

  #evidencia([Atividade 6 — evidência: commit `01caeb5` (terminal, 06/10/2026 19:50)], arquivo: "prints/evidencia-atv6-terminal.png")
  #evidencia([Atividade 6 — evidência: página do commit no GitHub], arquivo: "prints/evidencia-atv6-commit.png")
  #evidencia([Atividade 6 — resultado: perfil com foto de upload no MinIO], arquivo: "prints/resultado-atv6-perfil.png")
  #evidencia([Atividade 6 — resultado: recusa de editar perfil alheio (403)], arquivo: "prints/resultado-atv6-403.png")

  *Dificuldades e como foram resolvidas.* No primeiro deploy a foto não aparecia: `background-image` no CSS não manda o header `Authorization`, então a rota autenticada devolvia 401. A solução foi carregar a foto com `fetch` enviando o token e montar uma blob URL (`URL.createObjectURL`) para o avatar. Em seguida, uma entrada de cache do CDN armazenada com o código antigo exigiu subir o cache-buster para `?v=5` — o que reforçou a regra de nunca pré-aquecer a URL nova antes do redeploy terminar.
]

// ============================================================
= Considerações finais
// ============================================================
O bimestre mostrou, na prática, a distância entre "fazer funcionar na minha máquina" e "fazer funcionar em produção". A parte mais difícil foi operar o sistema em contêineres: rede interna entre serviços, variáveis de ambiente por ambiente, cache de CDN servindo versão velha e serviços sem persistência de volume zerando dados de auditoria. Cada um desses problemas virou uma lição documentada no README e, mais importante, um comportamento que hoje eu já antecipo antes de deplorar.

O ritmo de entrega não foi uniforme: o catálogo saiu antes do prazo, mas o desacoplamento do login e principalmente as atividades de RBAC e auditoria acumularam atraso e foram concluídas na reta final. Se pudesse fazer diferente, dividiria cada entrega em incrementos menores e faria o deploy de produção logo após cada atividade, em vez de concentrar o fechamento das demais no fim do período. Ainda assim, o projeto chegou completo: seis atividades entregues e comprovadas, com demonstrações automatizadas rodando contra o ambiente real.

Para o próximo bimestre, levo a rotina de validação automatizada (scripts de demonstração com saída verificável) e o hábito de registrar dificuldades e soluções à medida que acontecem — foi isso que permitiu que este relatório fosse escrito com datas e evidências reais, e não de memória.

// ============================================================
= Declaração de autoria
// ============================================================
Declaro que este relatório foi elaborado por mim, individualmente, e que as evidências apresentadas correspondem a entregas de minha autoria, verificáveis nos links informados. Nas atividades realizadas em grupo, o conteúdo aqui descrito refere-se à minha participação.

#v(1.5cm)
#grid(
  columns: (1fr, 1fr), gutter: 2cm,
  align(center)[#line(length: 100%, stroke: 0.5pt) \ #aluno],
  align(center)[#line(length: 100%, stroke: 0.5pt) \ Pompeia, #data-relatorio],
)