const API = "";
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "/login";
}

document.getElementById("user-name").textContent = localStorage.getItem("nome") || "Usuário";

let favoriteIds = new Set();
let allMovies = [];
let currentTab = "movies";
let currentMovie = null;

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
  if (res.status === 401) {
    localStorage.clear();
    window.location.href = "/login";
    return null;
  }
  return res.json();
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

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add("active");

  if (tab === "movies") {
    document.getElementById("loading").style.display = "block";
    document.getElementById("movies-grid").innerHTML = "";
    loadMovies();
  } else {
    loadFavorites();
  }
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
    const date = formatDate(c.criado_em);
    div.textContent = `${c.texto}${date ? " (" + date + ")" : ""}`;
    list.appendChild(div);
  });
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

function logout() {
  localStorage.clear();
  window.location.href = "/login";
}

document.getElementById("modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("modal")) closeModal();
});

loadMovies();
