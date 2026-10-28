
const express = require("express");
const mongoose = require("mongoose");
const Movie = require("../models/Movie");

const router = express.Router();

const genres = [
  "Action", "Comedy", "Drama", "Horror",
  "Sci-Fi", "Romance", "Thriller",
];
const platforms = [
  "Netflix", "Prime Video", "Hotstar", "Theatre", "Other",
];
const statuses = ["To Watch", "Watching", "Watched"];
const currentYear = new Date().getFullYear();

const reply = (res, status, success, message, data = null) =>
  res.status(status).json({ success, message, data });

function validateMovie(body, editing = false) {
  const errors = [];
  if (!editing && (!body.title || !body.title.trim()))
    errors.push("Title is required.");
  if (!genres.includes(body.genre))
    errors.push("Choose a valid genre.");
  if (!Number.isInteger(Number(body.releaseYear)) ||
      Number(body.releaseYear) < 1950 ||
      Number(body.releaseYear) > currentYear)
    errors.push(`Release year must be 1950–${currentYear}.`);
  if (!Number.isInteger(Number(body.runtime)) ||
      Number(body.runtime) < 30 || Number(body.runtime) > 300)
    errors.push("Runtime must be 30–300 minutes.");
  if (!platforms.includes(body.platform))
    errors.push("Choose a valid platform.");
  if (!Number.isInteger(Number(body.priority)) ||
      Number(body.priority) < 1 || Number(body.priority) > 5)
    errors.push("Priority must be an integer from 1 to 5.");
  return errors;
}

// Atomic, per-year sequence counter.
const counterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter ||
  mongoose.model("Counter", counterSchema);

async function nextCode(year) {
  const counter = await Counter.findOneAndUpdate(
    { _id: String(year) },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `MV-${year}-${String(counter.seq).padStart(3, "0")}`;
}

// ADD MOVIE
router.post("/", async (req, res, next) => {
  try {
    const errors = validateMovie(req.body);
    if (errors.length) return reply(res, 400, false, errors.join(" "));

    const title = req.body.title.trim();
    const year = Number(req.body.releaseYear);
    const normalizedTitle = title.toLowerCase();

    const duplicate = await Movie.findOne({ normalizedTitle, releaseYear: year });
    if (duplicate)
      return reply(res, 409, false, "This title and release year already exist.");

    const movie = await Movie.create({
      title,
      normalizedTitle,
      releaseYear: year,
      runtime: Number(req.body.runtime),
      priority: Number(req.body.priority),
      genre: req.body.genre,
      platform: req.body.platform,
      movieCode: await nextCode(year),
      status: "To Watch",
      rating: undefined,
      watchedDate: null,
    });

    reply(res, 201, true, "Movie added successfully.", movie);
  } catch (err) {
    if (err.code === 11000)
      return reply(res, 409, false, "Duplicate movie or movie code.");
    next(err);
  }
});

// LIST, FILTER, SEARCH, PAGINATION
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 6;
    const filter = {};

    if (req.query.status) {
      if (!statuses.includes(req.query.status))
        return reply(res, 400, false, "Invalid status.");
      filter.status = req.query.status;
    }
    if (req.query.genre) {
      if (!genres.includes(req.query.genre))
        return reply(res, 400, false, "Invalid genre.");
      filter.genre = req.query.genre;
    }
    if (req.query.search)
      filter.title = { $regex: req.query.search, $options: "i" };

    const total = await Movie.countDocuments(filter);
    const movies = await Movie.find(filter)
      .sort({ status: 1, priority: -1, runtime: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    reply(res, 200, true, "Movies retrieved.", {
      movies,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalMovies: total,
    });
  } catch (err) { next(err); }
});

// STATISTICS
router.get("/stats", async (req, res, next) => {
  try {
    const statusCounts = await Movie.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const watched = await Movie.aggregate([
      { $match: { status: "Watched" } },
      {
        $group: {
          _id: null,
          minutes: { $sum: "$runtime" },
          averageRating: { $avg: "$rating" },
        },
      },
    ]);
    const topGenre = await Movie.aggregate([
      { $match: { status: "Watched" } },
      { $group: { _id: "$genre", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 1 },
    ]);

    const counts = { "To Watch": 0, Watching: 0, Watched: 0 };
    statusCounts.forEach(x => { counts[x._id] = x.count; });

    const summary = watched[0] || { minutes: 0, averageRating: null };

    reply(res, 200, true, "Statistics calculated.", {
      statusCounts: counts,
      totalHoursWatched: Math.round(summary.minutes / 60 * 10) / 10,
      averageRating: summary.averageRating == null
        ? null : Math.round(summary.averageRating * 10) / 10,
      mostWatchedGenre: topGenre[0]?. _id || null,
    });
  } catch (err) { next(err); }
});

// WATCH NEXT
router.get("/watch-next", async (req, res, next) => {
  try {
    const movie = await Movie.findOne({ status: "To Watch" })
      .sort({ priority: -1, runtime: 1, createdAt: 1 });

    if (!movie)
      return reply(res, 404, false, "No movies are waiting to be watched.");
    reply(res, 200, true, "Your next movie recommendation.", movie);
  } catch (err) { next(err); }
});

// EDIT MOVIE DETAILS
router.put("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return reply(res, 400, false, "Invalid movie ID.");

    const movie = await Movie.findById(req.params.id);
    if (!movie) return reply(res, 404, false, "Movie not found.");

    const errors = validateMovie({
      ...movie.toObject(),
      ...req.body,
      releaseYear: movie.releaseYear,
    }, true);
    if (errors.length) return reply(res, 400, false, errors.join(" "));

    if (req.body.title !== undefined) {
      if (!req.body.title.trim())
        return reply(res, 400, false, "Title is required.");
      movie.title = req.body.title.trim();
      movie.normalizedTitle = movie.title.toLowerCase();
    }

    for (const key of ["genre", "runtime", "platform", "priority"]) {
      if (req.body[key] !== undefined)
        movie[key] = key === "runtime" || key === "priority"
          ? Number(req.body[key]) : req.body[key];
    }

    await movie.save();
    reply(res, 200, true, "Movie updated.", movie);
  } catch (err) {
    if (err.code === 11000)
      return reply(res, 409, false, "Duplicate title and release year.");
    next(err);
  }
});

// CHANGE STATUS / SET RATING
router.patch("/:id/status", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return reply(res, 400, false, "Invalid movie ID.");

    const movie = await Movie.findById(req.params.id);
    if (!movie) return reply(res, 404, false, "Movie not found.");

    const target = req.body.status;
    const allowed = {
      "To Watch": ["Watching", "Watched"],
      "Watching": ["Watched", "To Watch"],
      "Watched": [],
    };

    if (!allowed[movie.status].includes(target))
      return reply(res, 400, false,
        `Cannot change status from ${movie.status} to ${target}.`);

    if (target === "Watched") {
      const rating = Number(req.body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 10)
        return reply(res, 400, false,
          "A whole-number rating from 1 to 10 is required.");
      movie.rating = rating;
      movie.watchedDate = new Date();
    } else {
      movie.rating = undefined;
      movie.watchedDate = null;
    }

    movie.status = target;
    await movie.save();
    reply(res, 200, true, "Movie status updated.", movie);
  } catch (err) { next(err); }
});

// EDIT RATING OF AN ALREADY-WATCHED MOVIE
router.patch("/:id/rating", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return reply(res, 400, false, "Invalid movie ID.");

    const movie = await Movie.findById(req.params.id);
    if (!movie) return reply(res, 404, false, "Movie not found.");
    if (movie.status !== "Watched")
      return reply(res, 400, false, "Only Watched movies can be rated.");

    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 10)
      return reply(res, 400, false, "Rating must be a whole number from 1 to 10.");

    movie.rating = rating;
    await movie.save();
    reply(res, 200, true, "Rating updated.", movie);
  } catch (err) { next(err); }
});

// DELETE MOVIE
router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return reply(res, 400, false, "Invalid movie ID.");

    const movie = await Movie.findById(req.params.id);
    if (!movie) return reply(res, 404, false, "Movie not found.");
    if (movie.status === "Watching")
      return reply(res, 400, false, "Movies currently Watching cannot be deleted.");

    await movie.deleteOne();
    reply(res, 200, true, "Movie deleted.");
  } catch (err) { next(err); }
});

module.exports = router;
