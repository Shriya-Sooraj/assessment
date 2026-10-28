
import { useEffect, useState, useCallback } from "react";
import {
  getMovies,
  getStats,
  getWatchNext,
  addMovie,
  updateMovie,
  changeStatus,
  updateRating,
  deleteMovie,
} from "./services/api";
import "./index.css";

const GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Biography",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Sport",
  "Thriller",
  "War",
  "Western",
  "Other",
];

const PLATFORMS = [
  "Netflix",
  "Amazon Prime Video",
  "Disney+",
  "JioHotstar",
  "ZEE5",
  "Sony LIV",
  "Apple TV+",
  "YouTube",
  "Theatre",
  "Other",
];

const STATUSES = ["To Watch", "Watching", "Watched"];

const emptyMovie = {
  title: "",
  genre: "",
  releaseYear: "",
  runtime: "",
  platform: "",
  priority: "3",
  status: "To Watch",
};

export default function App() {
  const [movies, setMovies] = useState([]);
  const [stats, setStats] = useState(null);
  const [watchNext, setWatchNext] = useState(null);

  const [form, setForm] = useState(emptyMovie);
  const [editingId, setEditingId] = useState(null);

  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [movieResponse, statsResponse, nextResponse] =
        await Promise.all([
          getMovies({
            page,
            limit: 8,
            search,
            genre: genreFilter,
            status: statusFilter,
          }),
          getStats(),
          getWatchNext(),
        ]);

      const movieList = Array.isArray(movieResponse)
        ? movieResponse
        : movieResponse.movies || [];

      setMovies(movieList);
      setTotalPages(
        Array.isArray(movieResponse)
          ? 1
          : Math.max(1, Number(movieResponse.totalPages) || 1)
      );

      setStats(statsResponse || {});
      setWatchNext(nextResponse?.movie || null);
    } catch (err) {
      console.error("Failed to load application data:", err);

      setError(
        err.response?.data?.message ||
          "Could not load movies. Check that the backend is running at http://localhost:5000."
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, genreFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setNotice("");

    const releaseYear = Number(form.releaseYear);
    const runtime = Number(form.runtime);
    const priority = Number(form.priority);

    if (!form.title.trim() || !form.genre) {
      setError("Please enter a movie title and select a genre.");
      return;
    }

    if (
      !Number.isInteger(releaseYear) ||
      releaseYear < 1888 ||
      releaseYear > 2100
    ) {
      setError("Please enter a valid release year.");
      return;
    }

    if (!Number.isFinite(runtime) || runtime < 1) {
      setError("Runtime must be at least 1 minute.");
      return;
    }

    const movieData = {
      title: form.title.trim(),
      genre: form.genre,
      releaseYear,
      runtime,
      platform: form.platform,
      priority,
      status: form.status,
    };

    setSaving(true);

    try {
      if (editingId) {
        await updateMovie(editingId, movieData);
        setNotice("Movie updated successfully.");
      } else {
        await addMovie(movieData);
        setNotice("Movie added successfully.");
      }

      setForm(emptyMovie);
      setEditingId(null);
      setPage(1);

      // Refresh using the first page after a successful save.
      if (page !== 1) {
        setPage(1);
      } else {
        await loadData();
      }
    } catch (err) {
      console.error("Save movie error:", err);

      setError(
        err.response?.data?.message ||
          "Could not save the movie. Check the backend terminal and MongoDB connection."
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(movie) {
    setEditingId(movie._id);

    setForm({
      title: movie.title || "",
      genre: movie.genre || "",
      releaseYear: String(movie.releaseYear ?? ""),
      runtime: String(movie.runtime ?? ""),
      platform: movie.platform || "",
      priority: String(movie.priority ?? 3),
      status: movie.status || "To Watch",
    });

    setError("");
    setNotice("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyMovie);
    setError("");
    setNotice("");
  }

  async function handleStatusChange(movie, newStatus) {
    setError("");
    setNotice("");

    try {
      await changeStatus(movie._id, newStatus);
      setNotice("Watch status updated successfully.");
      await loadData();
    } catch (err) {
      console.error("Update status error:", err);
      setError(
        err.response?.data?.message || "Could not update watch status."
      );
    }
  }

  async function handleRatingChange(movie, value) {
    setError("");
    setNotice("");

    try {
      await updateRating(
        movie._id,
        value === "" ? null : Number(value)
      );

      setNotice("Movie rating updated successfully.");
      await loadData();
    } catch (err) {
      console.error("Update rating error:", err);
      setError(
        err.response?.data?.message || "Could not update rating."
      );
    }
  }

  async function handleDelete(movie) {
    const confirmed = window.confirm(
      `Delete "${movie.title}" from your watchlist?`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      await deleteMovie(movie._id);
      setNotice("Movie deleted successfully.");

      if (movies.length === 1 && page > 1) {
        setPage((previous) => previous - 1);
      } else {
        await loadData();
      }
    } catch (err) {
      console.error("Delete movie error:", err);
      setError(
        err.response?.data?.message || "Could not delete movie."
      );
    }
  }

  const statCards = [
    {
      label: "Total Movies",
      value: stats?.totalMovies ?? 0,
    },
    {
      label: "To Watch",
      value: stats?.toWatch ?? 0,
    },
    {
      label: "Watching",
      value: stats?.watching ?? 0,
    },
    {
      label: "Watched",
      value: stats?.watched ?? 0,
    },
    {
      label: "Top Watched Genre",
      value: stats?.mostWatchedGenre || "—",
    },
  ];

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">YOUR PERSONAL CINEMA SPACE</p>

          <h1>Movie Watchlist Manager</h1>

          <p className="hero-text">
            Keep track of what you want to watch, what you are
            watching, and what you have already enjoyed.
          </p>
        </div>

        <div className="hero-icon" aria-hidden="true">
          🎬
        </div>
      </header>

      {error && (
        <div className="message error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="message success" role="status">
          {notice}
        </div>
      )}

      <section className="stats-grid" aria-label="Watchlist statistics">
        {statCards.map((stat) => (
          <article className="stat-card" key={stat.label}>
            <p>{stat.label}</p>
            <h2>{stat.value}</h2>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <section className="panel">
          <h2>{editingId ? "Edit Movie" : "Add a Movie"}</h2>

          <form className="movie-form" onSubmit={handleSubmit}>
            <label>
              Movie Title
              <input
                name="title"
                value={form.title}
                onChange={handleFormChange}
                placeholder="e.g. Interstellar"
                maxLength={150}
                required
              />
            </label>

            <label>
              Genre
              <select
                name="genre"
                value={form.genre}
                onChange={handleFormChange}
                required
              >
                <option value="">Select a genre</option>

                {GENRES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-row">
              <label>
                Release Year
                <input
                  name="releaseYear"
                  type="number"
                  min="1888"
                  max="2100"
                  value={form.releaseYear}
                  onChange={handleFormChange}
                  placeholder="2025"
                  required
                />
              </label>

              <label>
                Runtime (minutes)
                <input
                  name="runtime"
                  type="number"
                  min="1"
                  max="1000"
                  value={form.runtime}
                  onChange={handleFormChange}
                  placeholder="120"
                  required
                />
              </label>
            </div>

            <label>
              Streaming Platform
              <select
                name="platform"
                value={form.platform}
                onChange={handleFormChange}
              >
                <option value="">Select a platform</option>

                {PLATFORMS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Priority
              <select
                name="priority"
                value={form.priority}
                onChange={handleFormChange}
              >
                <option value="1">1 - Lowest</option>
                <option value="2">2 - Low</option>
                <option value="3">3 - Medium</option>
                <option value="4">4 - High</option>
                <option value="5">5 - Highest</option>
              </select>
            </label>

            <label>
              Watch Status
              <select
                name="status"
                value={form.status}
                onChange={handleFormChange}
              >
                {STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save Changes"
                    : "Add Movie"}
              </button>

              {editingId && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="panel recommendation">
          <p className="eyebrow">YOUR NEXT PICK</p>
          <h2>What should you watch next?</h2>

          {watchNext ? (
            <>
              <h3>{watchNext.title}</h3>

              <p>
                {watchNext.genre || "Genre not specified"}
                {watchNext.releaseYear
                  ? ` · ${watchNext.releaseYear}`
                  : ""}
              </p>

              {watchNext.runtime && (
                <p>{watchNext.runtime} minutes</p>
              )}

              {watchNext.platform && <p>{watchNext.platform}</p>}

              <p>Priority: {watchNext.priority ?? "—"}</p>
            </>
          ) : (
            <p>
              Your next movie will appear here when you add a movie
              with the status “To Watch”.
            </p>
          )}
        </section>
      </section>

      <section className="panel library-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR COLLECTION</p>
            <h2>My Watchlist</h2>
          </div>

          <span className="movie-count">
            {movies.length} shown
          </span>
        </div>

        <div className="filters">
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search movie title..."
            aria-label="Search movies"
          />

          <select
            value={genreFilter}
            onChange={(event) => {
              setGenreFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by genre"
          >
            <option value="">All genres</option>

            {GENRES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>

            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="empty-state">Loading your watchlist...</p>
        ) : movies.length === 0 ? (
          <p className="empty-state">
            No movies found. Add a movie or change your filters.
          </p>
        ) : (
          <div className="movie-grid">
            {movies.map((movie) => (
              <article className="movie-card" key={movie._id}>
                <div className="movie-card-top">
                  <span className="movie-icon" aria-hidden="true">
                    🎞️
                  </span>

                  <span
                    className={`status-badge ${
                      (movie.status || "To Watch")
                        .toLowerCase()
                        .replace(/\s+/g, "-")
                    }`}
                  >
                    {movie.status}
                  </span>
                </div>

                <h3>{movie.title}</h3>

                <p className="movie-meta">
                  {movie.genre} · {movie.releaseYear}
                </p>

                <p className="movie-meta">
                  {movie.runtime} minutes
                </p>

                <p className="movie-meta">
                  Platform: {movie.platform || "Not specified"}
                </p>

                <p className="movie-meta">
                  Priority: {movie.priority ?? "—"}
                </p>

                <label className="card-control">
                  Watch Status
                  <select
                    value={movie.status || "To Watch"}
                    onChange={(event) =>
                      handleStatusChange(movie, event.target.value)
                    }
                  >
                    {STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="card-control">
                  Rating (1–10)
                  <select
                    value={movie.rating ?? ""}
                    onChange={(event) =>
                      handleRatingChange(movie, event.target.value)
                    }
                  >
                    <option value="">Not rated</option>

                    {Array.from(
                      { length: 10 },
                      (_, index) => index + 1
                    ).map((rating) => (
                      <option key={rating} value={rating}>
                        {rating}/10
                      </option>
                    ))}
                  </select>
                </label>

                <div className="card-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => startEdit(movie)}
                  >
                    Edit
                  </button>

                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => handleDelete(movie)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        
      
<div className="pagination">
  <button
    className="secondary-button"
    type="button"
    disabled={loading || page <= 1}
    onClick={() => {
      setPage((current) => Math.max(1, current - 1));
    }}
  >
    Previous
  </button>

  <span>
    Page {page} of {totalPages}
  </span>

  <button
    className="secondary-button"
    type="button"
    disabled={loading || page >= totalPages}
    onClick={() => {
      setPage((current) => Math.min(totalPages, current + 1));
    }}
  >
    Next
  </button>
</div>

      </section>

      <footer className="footer">
        Movie Watchlist Manager · Your next movie night starts here.
      </footer>
    </main>
  );
}
