const mongoose = require("mongoose");

const movieSchema = new mongoose.Schema(
  {
    movieCode: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedTitle: {
      type: String,
      required: true,
    },
    genre: {
      type: String,
      required: true,
      enum: [
        "Action", "Comedy", "Drama", "Horror",
        "Sci-Fi", "Romance", "Thriller",
      ],
    },
    releaseYear: {
      type: Number,
      required: true,
      min: 1950,
      max: new Date().getFullYear(),
      immutable: true,
    },
    runtime: {
      type: Number,
      required: true,
      min: 30,
      max: 300,
    },
    platform: {
      type: String,
      required: true,
      enum: [
        "Netflix", "Prime Video", "Hotstar",
        "Theatre", "Other",
      ],
    },
    priority: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: Number.isInteger,
    },
    status: {
      type: String,
      enum: ["To Watch", "Watching", "Watched"],
      default: "To Watch",
    },
    rating: {
      type: Number,
      min: 1,
      max: 10,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be a whole number from 1 to 10",
      },
    },
    watchedDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

movieSchema.index(
  { normalizedTitle: 1, releaseYear: 1 },
  { unique: true }
);

module.exports = mongoose.model("Movie", movieSchema);