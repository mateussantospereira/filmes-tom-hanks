import { Hono } from "hono";

const movies = new Hono();

movies.get("/", async (c) => {
  const query = c.req.query("q") || "Tom Hanks";
  const apiKey = process.env.TMDB_API_KEY;

  const searchRes = await fetch(
    `https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(query)}&api_key=${apiKey}`
  );
  const searchData = await searchRes.json();

  if (!searchData.results || searchData.results.length === 0) {
    return c.json({ movies: [] });
  }

  const personId = searchData.results[0].id;

  const creditsRes = await fetch(
    `https://api.themoviedb.org/3/person/${personId}/movie_credits?api_key=${apiKey}`
  );
  const creditsData = await creditsRes.json();

  const movieList = (creditsData.cast || []).map((m: any) => ({
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
