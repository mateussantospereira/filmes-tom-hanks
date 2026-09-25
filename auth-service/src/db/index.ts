import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { config } from "../config";
import * as schema from "./schema";

/**
 * O auth-service fala com o MESMO MariaDB do catalogo (ver README — "um banco,
 * dois donos"), mas so enxerga as tabelas `usuarios` e `reset_tokens`.
 */
export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  connectionLimit: 5,
});

export const db = drizzle(pool, { schema, mode: "default" });
