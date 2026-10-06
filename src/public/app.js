const API = "";
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "/login";
}

let favoriteIds = new Set();
let allMovies = [];
let currentTab = "movies";
let currentMovie = null;
let eu = { nome: localStorage.getItem("nome") || "Usuário", role: "usuario" };

function formatDate(raw) {
  if (!raw) return "";
  const d = new Date(raw.replace(" ", "T"));
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("pt-BR");
}

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
  });

  // 401 = token recusado pelo auth-service: encerra a sessao.
  if (res.status === 401) {
    localStorage.clear();
    window.location.href = "/login";
    return null;
  }

  const data = await res.json().catch(() => null);

  // 503 = o auth-service nao respondeu. Nao e caso de deslogar: e o servico de
  // autenticacao fora do ar, e o catalogo continua no ar servindo o catalogo.
  if (res.status === 503) {
    alert(data?.error || "Serviço de autenticação indisponível.");
    return null;
  }

  return data;
}

/**
 * Quem sou eu, e qual o meu papel?
 *
 * A resposta nao vem do que esta guardado no navegador: o catalogo pergunta ao
 * auth-service, que e o unico dono dessa informacao. E o papel de admin que
 * habilita (ou nao) a remocao dos comentarios dos outros usuarios.
 */
async function carregarSessao() {
  const res = await fetch(API + "/api/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    localStorage.clear();
    window.location.href = "/login";
    return;
  }

  const data = await res.json().catch(() => null);
  if (data && data.nome) eu = data;

  document.getElementById("user-name").textContent = eu.nome;
  const badge = document.getElementById("user-role");
  badge.textContent = eu.role;
  badge.classList.toggle("admin", eu.role === "admin");

  const podeVerLogs = (eu.permissoes ?? []).includes("consultar:logs");
  const tabLogs = document.getElementById("tab-logs-btn");
  if (tabLogs) {
    tabLogs.style.display = podeVerLogs ? "inline-block" : "none";
  }
}

function renderMovies(movies) {
  const grid = document.getElementById("movies-grid");
  grid.innerHTML = "";

  if (movies.length === 0) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--muted)">Nenhum filme encontrado.</p>';
    return;
  }

  movies.forEach((m) => {
    const card = document.createElement("div");
    card.className = "movie-card";
    card.style.position = "relative";
    const poster = m.poster_path
      ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
      : "https://via.placeholder.com/500x750?text=Sem+Pôster";
    const year = m.release_date ? m.release_date.substring(0, 4) : "N/A";
    const rating = m.vote_average?.toFixed(1) || "N/A";
    card.innerHTML = `
      <img src="${poster}" alt="${m.title}">
      <div class="card-info">
        <h3>${m.title}</h3>
        <p>${year} • ⭐ ${rating}</p>
      </div>
      ${favoriteIds.has(m.id) ? '<div class="fav-badge">⭐</div>' : ''}
    `;
    card.onclick = () => openModal(m);
    grid.appendChild(card);
  });
}

async function loadMovies() {
  document.getElementById("loading").style.display = "block";
  document.getElementById("movies-grid").innerHTML = "";

  const [movieData, favs] = await Promise.all([
    api("/api/movies"),
    api("/api/favorites"),
  ]);

  document.getElementById("loading").style.display = "none";

  if (favs) favoriteIds = new Set(favs.map((f) => f.tmdbMovieId));
  if (movieData && movieData.movies) allMovies = movieData.movies;

  renderMovies(allMovies);
}

async function loadFavorites() {
  document.getElementById("loading").style.display = "block";
  document.getElementById("movies-grid").innerHTML = "";

  const favs = await api("/api/favorites");
  document.getElementById("loading").style.display = "none";

  if (!favs || favs.length === 0) {
    document.getElementById("movies-grid").innerHTML =
      '<p style="grid-column:1/-1;text-align:center;color:var(--muted)">Nenhum filme favoritado ainda.</p>';
    return;
  }

  const favMovies = favs.map((f) => ({
    id: f.tmdbMovieId,
    title: f.titulo,
    poster_path: f.posterPath,
    overview: "",
    release_date: "",
    vote_average: null,
  }));

  renderMovies(favMovies);
}

function switchTab(tab, dadosPerfil) {
  currentTab = tab;
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  document.querySelector(`.tab-btn[data-tab="${tab}"]`)?.classList.add("active");

  const moviesGrid = document.getElementById("movies-grid");
  const logsContainer = document.getElementById("logs-container");
  const perfilContainer = document.getElementById("perfil-container");
  const loading = document.getElementById("loading");

  if (tab === "movies") {
    if (logsContainer) logsContainer.style.display = "none";
    if (perfilContainer) perfilContainer.style.display = "none";
    moviesGrid.style.display = "grid";
    loading.style.display = "block";
    moviesGrid.innerHTML = "";
    loadMovies();
  } else if (tab === "favorites") {
    if (logsContainer) logsContainer.style.display = "none";
    if (perfilContainer) perfilContainer.style.display = "none";
    moviesGrid.style.display = "grid";
    loadFavorites();
  } else if (tab === "logs") {
    moviesGrid.style.display = "none";
    loading.style.display = "none";
    if (perfilContainer) perfilContainer.style.display = "none";
    if (logsContainer) {
      logsContainer.style.display = "block";
      carregarLogs();
    }
  } else if (tab === "perfil") {
    moviesGrid.style.display = "none";
    loading.style.display = "none";
    if (logsContainer) logsContainer.style.display = "none";
    if (perfilContainer) {
      perfilContainer.style.display = "block";
      // Sem parametro = meu perfil. Com parametro = perfil de outra pessoa
      // (vindo de um clique no autor de um comentario), ja renderizado.
      if (dadosPerfil) renderPerfil(dadosPerfil, dadosPerfil.meuPerfil);
      else carregarPerfil();
    }
  }
}

async function carregarLogs() {
  const list = document.getElementById("logs-list");
  if (!list) return;
  while (list.firstChild) list.removeChild(list.firstChild);

  const loadingP = document.createElement("p");
  loadingP.textContent = "Carregando registros de auditoria...";
  loadingP.style.color = "var(--muted)";
  list.appendChild(loadingP);

  const res = await api("/api/logs?limite=100");
  while (list.firstChild) list.removeChild(list.firstChild);

  if (!res || !Array.isArray(res.eventos) || res.eventos.length === 0) {
    const emptyP = document.createElement("p");
    emptyP.textContent = "Nenhum evento registrado ainda.";
    emptyP.style.color = "var(--muted)";
    list.appendChild(emptyP);
    return;
  }

  res.eventos.forEach((ev) => {
    const item = document.createElement("div");
    item.className = "comment-item";
    item.style.flexDirection = "column";
    item.style.alignItems = "flex-start";
    item.style.gap = "4px";
    item.style.marginBottom = "8px";

    const topRow = document.createElement("div");
    topRow.style.display = "flex";
    topRow.style.gap = "8px";
    topRow.style.alignItems = "center";
    topRow.style.width = "100%";

    const acaoBadge = document.createElement("span");
    acaoBadge.className = "role-badge";
    if (ev.acao === "acao_negada" || ev.acao === "login_falhou") {
      acaoBadge.style.background = "rgba(239, 68, 68, 0.2)";
      acaoBadge.style.color = "#f87171";
    } else {
      acaoBadge.style.background = "rgba(34, 197, 94, 0.2)";
      acaoBadge.style.color = "#4ade80";
    }
    acaoBadge.textContent = ev.acao || "evento";
    topRow.appendChild(acaoBadge);

    const timeSpan = document.createElement("span");
    timeSpan.style.fontSize = "0.8rem";
    timeSpan.style.color = "var(--muted)";
    timeSpan.textContent = formatDate(ev.timestamp || ev.criado_em) || (ev.timestamp ?? "");
    topRow.appendChild(timeSpan);

    if (ev.origem) {
      const origemSpan = document.createElement("span");
      origemSpan.style.fontSize = "0.75rem";
      origemSpan.style.color = "var(--muted)";
      origemSpan.textContent = `[${ev.origem}]`;
      topRow.appendChild(origemSpan);
    }

    item.appendChild(topRow);

    const detailP = document.createElement("p");
    detailP.style.fontSize = "0.9rem";
    detailP.style.margin = "0";

    const userStrong = document.createElement("strong");
    userStrong.textContent = ev.usuario ? `${ev.usuario} (${ev.papel || "usuario"}): ` : `Anônimo: `;
    detailP.appendChild(userStrong);

    const descText = document.createTextNode(
      (ev.recurso ? `Recurso: ${ev.recurso}` : "") +
      (ev.detalhe ? ` | Detalhe: ${ev.detalhe}` : "") +
      (ev.ip ? ` | IP: ${ev.ip}` : "")
    );
    detailP.appendChild(descText);

    item.appendChild(detailP);
    list.appendChild(item);
  });
}

/**
 * Atividade 6 — aba de perfil.
 *
 * A foto NUNCA vem do banco: `fotoUrl` aponta para /api/perfil/:id/foto, que
 * o catalogo serve buscando os bytes no MinIO. O MariaDB guarda so a chave.
 */
async function carregarPerfil() {
  const conteudo = document.getElementById("perfil-conteudo");
  if (!conteudo) return;
  const res = await api("/api/perfil");
  if (!res) return;
  renderPerfil(res, true);
}

function renderPerfil(d, meuPerfil) {
  const conteudo = document.getElementById("perfil-conteudo");
  if (!conteudo) return;
  while (conteudo.firstChild) conteudo.removeChild(conteudo.firstChild);

  const card = document.createElement("div");
  card.className = "perfil-card";

  const topo = document.createElement("div");
  topo.className = "perfil-topo";

  // Avatar: se ha foto, backgroundImage; senao, a inicial do nome.
  const avatar = document.createElement("div");
  avatar.className = "perfil-avatar" + (d.fotoUrl ? "" : " sem-foto");
  avatar.textContent = d.fotoUrl ? "" : (d.nome || "?").trim().charAt(0).toUpperCase();
  if (d.fotoUrl) avatar.style.backgroundImage = `url("${d.fotoUrl}?ts=${Date.now()}")`;
  topo.appendChild(avatar);

  const info = document.createElement("div");
  info.className = "perfil-info";

  const linhaNome = document.createElement("div");
  linhaNome.style.display = "flex";
  linhaNome.style.alignItems = "center";
  linhaNome.style.gap = "10px";
  linhaNome.style.flexWrap = "wrap";

  const nome = document.createElement("h2");
  nome.textContent = d.nome;
  linhaNome.appendChild(nome);

  const badge = document.createElement("span");
  badge.className = "role-badge" + (d.role === "admin" ? " admin" : "");
  badge.textContent = d.role;
  linhaNome.appendChild(badge);

  info.appendChild(linhaNome);

  if (meuPerfil) {
    const aviso = document.createElement("p");
    aviso.className = "perfil-aviso";
    aviso.textContent =
      "Sua foto não vai para o banco: o arquivo fica no MinIO (object storage) e aqui só a referência.";
    info.appendChild(aviso);

    const textarea = document.createElement("textarea");
    textarea.id = "perfil-bio-input";
    textarea.className = "perfil-bio-input";
    textarea.maxLength = 300;
    textarea.placeholder = "Escreva uma bio curta (até 300 caracteres)...";
    textarea.value = d.bio || "";
    info.appendChild(textarea);

    const salvar = document.createElement("button");
    salvar.className = "perfil-salvar";
    salvar.textContent = "💾 Salvar bio";
    salvar.onclick = salvarBio;
    info.appendChild(salvar);

    const rotulo = document.createElement("label");
    rotulo.className = "perfil-upload";
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/gif,image/webp";
    input.onchange = () => enviarFoto(input);
    const texto = document.createElement("span");
    texto.textContent = d.fotoUrl ? "📷 Trocar foto" : "📷 Enviar foto";
    rotulo.appendChild(input);
    rotulo.appendChild(texto);
    rotulo.appendChild(document.createTextNode(" (PNG/JPEG/GIF/WebP, máx 2 MB)"));
    info.appendChild(rotulo);
  } else {
    const bioP = document.createElement("p");
    bioP.className = "perfil-bio-texto";
    bioP.textContent = d.bio || "Este usuário ainda não escreveu uma bio.";
    info.appendChild(bioP);

    const voltar = document.createElement("button");
    voltar.className = "perfil-voltar";
    voltar.textContent = "← Voltar ao meu perfil";
    voltar.onclick = () => switchTab("perfil");
    info.appendChild(voltar);
  }

  topo.appendChild(info);
  card.appendChild(topo);

  const favTitulo = document.createElement("h3");
  favTitulo.className = "perfil-fav-titulo";
  favTitulo.textContent = "⭐ Filmes favoritados";
  card.appendChild(favTitulo);

  const favGrid = document.createElement("div");
  favGrid.className = "movies-grid";

  if (!d.favoritos || d.favoritos.length === 0) {
    const vazio = document.createElement("p");
    vazio.style.gridColumn = "1/-1";
    vazio.style.textAlign = "center";
    vazio.style.color = "var(--muted)";
    vazio.textContent = "Nenhum filme favoritado ainda.";
    favGrid.appendChild(vazio);
  } else {
    d.favoritos.forEach((f) => {
      const poster = f.posterPath
        ? `https://image.tmdb.org/t/p/w500${f.posterPath}`
        : "https://via.placeholder.com/500x750?text=Sem+Pôster";
      const cartao = document.createElement("div");
      cartao.className = "movie-card";
      const img = document.createElement("img");
      img.src = poster;
      img.alt = f.titulo;
      const cardInfo = document.createElement("div");
      cardInfo.className = "card-info";
      const titulo = document.createElement("h3");
      titulo.textContent = f.titulo;
      cardInfo.appendChild(titulo);
      cartao.appendChild(img);
      cartao.appendChild(cardInfo);
      cartao.onclick = () =>
        openModal({
          id: f.tmdbMovieId,
          title: f.titulo,
          poster_path: f.posterPath,
          overview: "",
          release_date: "",
          vote_average: null,
        });
      favGrid.appendChild(cartao);
    });
  }
  card.appendChild(favGrid);

  conteudo.appendChild(card);
}

/** Abre a aba Perfil mostrando o perfil de OUTRA pessoa (clique no autor). */
async function verPerfilDe(usuarioId) {
  const res = await api(`/api/perfil/${usuarioId}`);
  if (!res) return;
  switchTab("perfil", res);
}

async function salvarBio() {
  const area = document.getElementById("perfil-bio-input");
  if (!area) return;
  const texto = area.value.trim();
  if (texto.length > 300) {
    alert("A bio deve ter no máximo 300 caracteres.");
    return;
  }
  const res = await fetch(API + "/api/perfil/" + eu.usuarioId, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ bio: texto }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    alert(data?.error || "Falha ao salvar a bio.");
    return;
  }
  carregarPerfil();
}

async function enviarFoto(input) {
  const arquivo = input.files && input.files[0];
  if (!arquivo) return;
  if (!arquivo.type.startsWith("image/")) {
    alert("Só imagens: PNG, JPEG, GIF ou WebP.");
    return;
  }
  if (arquivo.size > 2 * 1024 * 1024) {
    alert("A foto deve ter no máximo 2 MB.");
    return;
  }
  const form = new FormData();
  form.append("foto", arquivo);
  const res = await fetch(API + "/api/perfil/" + eu.usuarioId + "/foto", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }, // sem Content-Type: o fetch põe o boundary sozinho
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    alert(data?.error || "Falha no upload da foto.");
    return;
  }
  carregarPerfil();
}

function openModal(movie) {
  currentMovie = movie;
  const poster = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : "https://via.placeholder.com/500x750?text=Sem+Pôster";

  document.getElementById("modal-poster").src = poster;
  document.getElementById("modal-title").textContent = movie.title;
  document.getElementById("modal-overview").textContent = movie.overview || "Sem sinopse disponível.";
  updateFavButton();
  loadComments();
  document.getElementById("modal").style.display = "flex";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
  currentMovie = null;
}

function updateFavButton() {
  const btn = document.getElementById("btn-fav");
  if (favoriteIds.has(currentMovie.id)) {
    btn.textContent = "Remover dos favoritos";
    btn.classList.add("active");
  } else {
    btn.textContent = "⭐ Favoritar";
    btn.classList.remove("active");
  }
}

async function toggleFavorite() {
  if (!currentMovie) return;

  if (favoriteIds.has(currentMovie.id)) {
    await api(`/api/favorites/${currentMovie.id}`, { method: "DELETE" });
    favoriteIds.delete(currentMovie.id);
  } else {
    await api("/api/favorites", {
      method: "POST",
      body: JSON.stringify({
        tmdb_movie_id: currentMovie.id,
        titulo: currentMovie.title,
        poster_path: currentMovie.poster_path,
      }),
    });
    favoriteIds.add(currentMovie.id);
  }
  updateFavButton();
  loadMovies();
}

async function loadComments() {
  if (!currentMovie) return;
  const comments = await api(`/api/comments/${currentMovie.id}`);
  const list = document.getElementById("comments-list");
  list.innerHTML = "";

  if (!comments || comments.length === 0) {
    list.innerHTML = '<p style="color:var(--muted);font-size:0.9rem">Nenhum comentário ainda.</p>';
    return;
  }

  comments.forEach((c) => {
    const div = document.createElement("div");
    div.className = "comment-item";
    const date = formatDate(c.criadoEm || c.criado_em);
    const isOwner = (c.usuarioId ?? c.usuario_id) === eu.usuarioId;

    // A interface esconde o botao pela PERMISSAO devolvida pelo auth-service,
    // nunca por `role === "admin"`. Esconder botao nao e seguranca: o servidor
    // confere de novo e responde 403 para quem chamar a API direto.
    const permissoes = eu.permissoes ?? [];
    const podeModerar = permissoes.includes("apagar:comentario-de-outro");

    // Nada de innerHTML com conteudo de usuario. `autor` e `texto` vem de fora
    // (qualquer um digita o que quiser) e innerHTML executaria o que a pessoa
    // escrever no navegador de quem le. Monta o no com textContent, que trata
    // tudo como texto mesmo que venha `<svg onload=...>`.
    const textSpan = document.createElement("span");
    if (c.autor) {
      // Atividade 6: o nome do autor abre o perfil dele (rede social).
      const autor = document.createElement("button");
      autor.className = "link-autor";
      autor.textContent = c.autor;
      autor.title = "Ver perfil";
      autor.onclick = () => verPerfilDe(c.usuarioId ?? c.usuario_id);
      textSpan.appendChild(autor);
      textSpan.appendChild(document.createTextNode(": "));
    }
    textSpan.appendChild(document.createTextNode(c.texto));
    if (date) {
      const quando = document.createElement("span");
      quando.style.fontSize = "0.75rem";
      quando.style.color = "var(--muted)";
      quando.textContent = ` (${date})`;
      textSpan.appendChild(quando);
    }
    div.appendChild(textSpan);

    // RBAC: dono apaga o seu; quem tem `apagar:comentario-de-outro` apaga o de
    // qualquer um. Mesmo que alguem burle a interface, o servidor recusa com 403.
    if (podeModerar || isOwner) {
      const btn = document.createElement("button");
      btn.className = "btn-apagar";
      btn.textContent = "×";
      btn.title = podeModerar && !isOwner ? "Moderar comentário (Exclusivo de Admin)" : "Apagar meu comentário";
      btn.onclick = () => deleteComment(c.id);
      div.appendChild(btn);
    }

    list.appendChild(div);
  });
}

async function deleteComment(id) {
  const resposta = await api(`/api/comments/${id}`, { method: "DELETE" });
  if (resposta && resposta.error) {
    alert(resposta.error);
    return;
  }
  loadComments();
}

async function saveComment() {
  if (!currentMovie) return;
  const text = document.getElementById("comment-text").value.trim();
  if (!text) return;

  await api("/api/comments", {
    method: "POST",
    body: JSON.stringify({
      tmdb_movie_id: currentMovie.id,
      texto: text,
    }),
  });

  document.getElementById("comment-text").value = "";
  loadComments();
}

async function logout() {
  try {
    await fetch("/api/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {}
  localStorage.clear();
  window.location.href = "/login";
}

document.getElementById("modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("modal")) closeModal();
});

carregarSessao();
loadMovies();
