// ============================================================
//  P1 — Relatório bimestral de atividades (entrega INDIVIDUAL)
//  ISW055 · Introdução à Computação em Nuvem · Fatec Pompeia · 2026.2
//
//  Compilar: typst compile P1_ISW055_template.typ
//  Saída:    P1_ISW055_Mateus_dos_Santos_Pereira.pdf
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
        #text(fill: luma(130), size: 9.5pt)[print pendente — troque `arquivo: none`]
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
Na disciplina ISW055 — *Introdução à Computação em Nuvem*, da Fatec Pompeia, a gente estuda o básico de como funcionam os sistemas na nuvem: microsserviços, contêineres, banco de dados, autenticação, controle de acesso e logs. O que guiou o bimestre inteiro foi um projeto só: um catálogo de filmes do Tom Hanks, que foi crescendo aos poucos. Começou simples e terminou virando um sistema com vários serviços rodando em contêineres, publicado na internet.

Foram seis atividades no total. Primeiro fizemos uma agenda bem simples em Flask, em sala, como nivelamento. Depois veio o catálogo de filmes consumindo a API do TMDb e salvando no MariaDB. Na sequência o login foi separado num microsserviço próprio, veio o controle de acesso por perfil (RBAC), os logs e a auditoria, e por último o perfil do usuário com foto salva no MinIO. Tudo ficou no mesmo repositório público do GitHub, com deploy num ambiente de produção.

Este relatório junta tudo isso num documento só: mostra o que era pra ser feito e quando, o que eu realmente entreguei e quando, com uma ficha por atividade trazendo o link da evidência e os prints comprovando. No final escrevo o que aprendi, o que foi mais difícil e o que eu faria diferente.

// ============================================================
= Metodologia
// ============================================================
Todas as atividades foram feitas no mesmo repositório público do GitHub (`mateussantospereira/filmes-tom-hanks`), como continuação do mesmo projeto. Para programar usei Bun e o framework Hono nas APIs, o banco era MariaDB, os serviços rodavam em Docker Compose e o deploy era feito pelo Portainer. Os arquivos de upload foram para o MinIO e os logs de auditoria para o Redis, lidos por um serviço de logs separado. Cada atividade eu testava na minha máquina e, quando possível, publicava no ambiente de produção usado nas demonstrações (`https://mateus-pereira-isw055.lapps.studio`).

As datas e horas de cada entrega foram tiradas do histórico de commits do repositório com o comando `git log` (no formato DD/MM/AAAA HH:MM) e conferidas na página de cada commit no GitHub. Para cada atividade o relatório traz duas provas: um print do terminal com o `git log` (mostrando o hash, a data/hora e o repositório) e o print da própria página do commit no GitHub — além do print do sistema funcionando. O README do repositório documenta cada atividade, mostra a arquitetura e menciona o professor (`github.com/siriani`).

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
  *O que foi feito.* A primeira atividade foi um nivelamento em sala: uma agenda telefônica bem simples em Flask com templates Jinja, onde dá para cadastrar, listar, editar e remover contatos. Não tinha banco de dados — os contatos ficavam no `localStorage` do navegador, de propósito. Era só para a turma se acostumar com o padrão rota → função → template antes de começar o projeto grande.

  #evidencia([Atividade 1 — resultado: agenda telefônica em Flask rodando], arquivo: "prints/resultado-atv1-agenda.png")

  *Dificuldades e como foram resolvidas.* Não teve dificuldade técnica, era um nivelamento. O código não foi para o GitHub na época, só rodou em sala, e o print de comprovação é o que está acima.
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
  *O que foi feito.* Criei o repositório e o catálogo de filmes do Tom Hanks: a aplicação busca os filmes na API do TMDb, guarda os dados no MariaDB e tem uma área logada onde cada usuário tem os próprios favoritos (segregação por usuário). Montei também o docker-compose para a aplicação e o banco rodarem juntos, com deploy via Portainer. O README documenta a arquitetura, o uso e o endereço de produção, e menciona o professor.

  #evidencia([Atividade 2 — evidência: commit `c795793` (terminal, 18/08/2026 17:48)], arquivo: "prints/evidencia-atv2-terminal.png")
  #evidencia([Atividade 2 — evidência: página do commit no GitHub], arquivo: "prints/evidencia-atv2-commit.png")
  #evidencia([Atividade 2 — resultado: catálogo logado em produção], arquivo: "prints/resultado-atv2-catalogo.png")

  *Dificuldades e como foram resolvidas.* A primeira montagem do ambiente deu trabalho: dependências e a rede do Docker. Resolvi separando o lockfile e o compose em commits próprios, para o build ficar determinístico e repetível no Portainer.
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
  *O que foi feito.* Extraí a autenticação do catálogo para um serviço separado (`auth-service`), que passou a ser o único dono da tabela de usuários e da lógica de senha, JWT e papel. O catálogo virou um gateway: as rotas de login, cadastro, `esqueci minha senha` e reset só repassam a chamada para o auth-service pela rede interna do Docker (`AUTH_SERVICE_URL`). A recuperação de senha envia e-mail de verdade pelo Mailtrap, e o docker-compose.yml documenta os dois serviços.

  #evidencia([Atividade 3 — evidência: commit `d08ced9` (terminal, 25/09/2026 16:21)], arquivo: "prints/evidencia-atv3-terminal.png")
  #evidencia([Atividade 3 — evidência: página do commit no GitHub], arquivo: "prints/evidencia-atv3-commit.png")
  #evidencia([Atividade 3 — resultado: tela de login em produção], arquivo: "prints/resultado-atv3-login.png")
  #evidencia([Atividade 3 — resultado: e-mail de recuperação de senha (Mailtrap)], arquivo: "prints/resultado-atv3-mailtrap.png")
  #evidencia([Atividade 3 — resultado: fluxo de redefinição de senha], arquivo: "prints/resultado-atv3-recuperacao.png")

  *Dificuldades e como foram resolvidas.* Sincronizar dois serviços numa rede interna sem expor o auth-service para fora exigiu cuidado com a variável `AUTH_SERVICE_URL` (nome do serviço, não `localhost`) e com timeouts, para não travar a requisição do usuário. Os ajustes finos dos defaults e das dependências ficaram para a semana seguinte, o que atrasou a entrega.
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
  *O que foi feito.* O campo `role` deixou de ser só enfeite e passou a valer de verdade no servidor: criei um mapa de permissões (`auth-service/src/auth/permissoes.ts`), onde `admin` é superconjunto de `usuario` e qualquer permissão ausente nega (sempre *fail-closed*). O `GET /me` devolve as permissões resolvidas e o catálogo checa `permissoes.includes(...)` em vez de comparar `role === "admin"`. Ações exclusivas de admin (apagar comentário de terceiro, listar usuários, mudar papel) devolvem 403 para usuário comum. Também consertei um XSS guardado em comentários, trocando `innerHTML` por `textContent`.

  #evidencia([Atividade 4 — evidência: commit `d83b05d` (terminal, 06/10/2026 11:18)], arquivo: "prints/evidencia-atv4-terminal.png")
  #evidencia([Atividade 4 — evidência: página do commit no GitHub], arquivo: "prints/evidencia-atv4-commit.png")
  #evidencia([Atividade 4 — resultado: 403 para usuário comum], arquivo: "prints/resultado-atv4-rbac-403.png")
  #evidencia([Atividade 4 — resultado: a mesma ação autorizada para admin], arquivo: "prints/resultado-atv4-rbac-admin.png")

  *Dificuldades e como foram resolvidas.* Essa atrasou porque fui desenvolvendo junto com as outras atividades. A parte mais chata foi provar a regra dos dois lados: a demonstração usa uma terceira conta como alvo, para a exclusão pelo admin acontecer por *permissão* e não por *ownership*. O XSS apareceu quando revisei o frontend e corrigi antes de entregar.
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
  *O que foi feito.* Criei um serviço de logs (`log-service`) que consome os eventos de um Redis Streams e deixa tudo pronto para consulta: login, ações sensíveis e tentativas negadas com 403. Um middleware global de auditoria pega qualquer `acao_negada` na borda do catálogo e publica no stream; o admin consulta os eventos pela tela de auditoria do sistema. Nas atividades seguintes o mesmo mecanismo passou a registrar também `upload_foto` e `editar_perfil`.

  #evidencia([Atividade 5 — evidência: commit `dca3a82` (terminal, 06/10/2026 18:30)], arquivo: "prints/evidencia-atv5-terminal.png")
  #evidencia([Atividade 5 — evidência: página do commit no GitHub], arquivo: "prints/evidencia-atv5-commit.png")
  #evidencia([Atividade 5 — resultado: consulta dos logs de auditoria pelo admin], arquivo: "prints/resultado-atv5-auditoria.png")

  *Dificuldades e como foram resolvidas.* O Redis e o log-service não persistem volume, então o stream de auditoria zera a cada redeploy — comportamento esperado e documentado, mas a demonstração precisa rodar com os serviços ativos. Também tive de versionar os arquivos estáticos (`?v=`) para o cache do CDN não servir script velho.
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
  *O que foi feito.* A página de perfil ganhou bio e foto: o arquivo enviado vai para o bucket privado `perfis` do MinIO (com volume no compose), a referência fica no MariaDB e a foto volta ao navegador por uma rota autenticada do catálogo (`GET /api/perfil/:id/foto`). O upload é validado no servidor: só imagem (415) e no máximo 2 MB (413). A identidade vem do token, nunca do ID que a pessoa manda no corpo ou na URL — editar ou fotografar o perfil de outra pessoa devolve 403 (`permissao_exigida: "editar:perfil-proprio"`), e o evento entra na auditoria como `acao_negada`.

  #evidencia([Atividade 6 — evidência: commit `01caeb5` (terminal, 06/10/2026 19:50)], arquivo: "prints/evidencia-atv6-terminal.png")
  #evidencia([Atividade 6 — evidência: página do commit no GitHub], arquivo: "prints/evidencia-atv6-commit.png")
  #evidencia([Atividade 6 — resultado: perfil com foto de upload no MinIO], arquivo: "prints/resultado-atv6-perfil.png")
  #evidencia([Atividade 6 — resultado: recusa de editar perfil alheio (403)], arquivo: "prints/resultado-atv6-403.png")

  *Dificuldades e como foram resolvidas.* No primeiro deploy a foto não aparecia: `background-image` no CSS não manda o header `Authorization`, então a rota autenticada devolvia 401. Resolvi carregando a foto com `fetch` mandando o token e montando uma blob URL (`URL.createObjectURL`) para o avatar. Depois, uma entrada velha do cache do CDN fez o `?v=4` não atualizar, e subi para `?v=5` — aprendi a nunca pré-aquecer a URL nova antes do redeploy terminar.
]

// ============================================================
= Considerações finais
// ============================================================
Durante o bimestre eu percebi na prática a diferença entre "funcionar na minha máquina" e "funcionar em produção". A parte mais difícil foi operar o sistema em contêineres: rede interna entre serviços, variáveis de ambiente diferentes, cache de CDN servindo versão velha e serviço sem volume persistente zerando os logs. Cada problema virou uma lição que deixei anotada no README, e hoje eu já antecipo essas coisas antes de publicar.

O ritmo não foi uniforme: o catálogo saiu até antes do prazo, mas desacoplar o login e principalmente RBAC e auditoria atrasaram e fecharam na reta final. Se eu fosse refazer, dividiria cada atividade em partes menores e faria o deploy logo depois de cada uma, em vez de concentrar o fechamento no fim do período. Mesmo assim, as seis atividades estão entregues e comprovadas, com scripts de demonstração rodando contra o ambiente real.

Para o próximo bimestre levo a rotina de validar com scripts automáticos (saída verificável) e o hábito de anotar as dificuldades na hora — foi isso que deixou este relatório com datas e evidências reais, sem depender da memória.

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