import { Hono } from "hono";

/**
 * Catalogo de filmes do TMDB. Nao tem nada a ver com autenticacao: e a parte
 * do sistema que continua publica e sem login.
 */
const movies = new Hono();

type TmdbSearch = { results?: { id: number }[] };
type TmdbCredito = {
  cast?: {
    id: number;
    title: string;
    overview: string;
    poster_path: string | null;
    release_date: string;
    vote_average: number;
  }[];
};

movies.get("/", async (c) => {
  const query = c.req.query("q") || "Tom Hanks";
  const apiKey = process.env.TMDB_API_KEY;

  const searchRes = await fetch(
    `https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(query)}&api_key=${apiKey}`
  );
  const searchData = (await searchRes.json()) as TmdbSearch;

  if (!searchData.results || searchData.results.length === 0) {
    return c.json({ movies: [] });
  }

  const personId = searchData.results[0].id;

  const creditsRes = await fetch(
    `https://api.themoviedb.org/3/person/${personId}/movie_credits?api_key=${apiKey}`
  );
  const creditsData = (await creditsRes.json()) as TmdbCredito;

  const movieList = (creditsData.cast || []).map((m) => ({
    id: m.id,
    title: m.title,
    overview: m.overview,
    poster_path: m.poster_path,
    release_date: m.release_date,
    vote_average: m.vote_average,
  }));

  return c.json({ movies: movieList });
});

export default movies;
