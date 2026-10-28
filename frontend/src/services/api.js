
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api/movies",
  headers: {
    "Content-Type": "application/json",
  },
});

export async function getMovies(params = {}) {
  const response = await api.get("/", { params });
  return response.data;
}

export async function getStats() {
  const response = await api.get("/stats");
  return response.data;
}

export async function getWatchNext() {
  const response = await api.get("/watch-next");
  return response.data;
}

export async function addMovie(movie) {
  const response = await api.post("/", movie);
  return response.data;
}

export async function updateMovie(id, movie) {
  const response = await api.put(`/${id}`, movie);
  return response.data;
}

export async function changeStatus(id, status, rating) {
  const response = await api.patch(`/${id}/status`, {
    status,
    ...(rating !== undefined ? { rating } : {}),
  });
  return response.data;
}

export async function updateRating(id, rating) {
  const response = await api.patch(`/${id}/rating`, { rating });
  return response.data;
}

export async function deleteMovie(id) {
  const response = await api.delete(`/${id}`);
  return response.data;
}
