import axios from "axios";

const api = axios.create({
    baseURL: "http://localhost:8000",
    timeout: 10_000,
    headers: { "Content-Type": "application/json" },
});

export const fetchStats = () => api.get("/stats").then((r) => r.data);
export const fetchFlows = (params) => api.get("/flows", { params }).then((r) => r.data);
export const fetchAlerts = () => api.get("/alerts").then((r) => r.data);
export const healthCheck = () => api.get("/health").then((r) => r.data);

export default api;
