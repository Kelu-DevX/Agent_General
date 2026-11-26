import { Hono } from "hono";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();
app.get("/", (c) => c.html(<h1>7B</h1>));

export default app;
