import { createMiddleware } from "hono/factory";
import jwt from "jsonwebtoken";

export const authMiddleware = createMiddleware(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Token ausente" }, 401);
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      usuarioId: number;
    };
    c.set("usuarioId", payload.usuarioId);
    await next();
  } catch {
    return c.json({ error: "Token inválido" }, 401);
  }
});
