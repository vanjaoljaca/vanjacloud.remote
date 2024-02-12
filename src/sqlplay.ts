
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";

const sqlite = new Database("./data/sqlite.db");
const db = drizzle(sqlite);

import { sql } from "drizzle-orm";

const query = sql`select "hello world" as text`;
const result = db.get<{ text: string }>(query);
console.log(result);

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// https://bun.sh/guides/ecosystem/drizzle
export const movies = sqliteTable("movies", {
    id: integer("id").primaryKey(),
    title: text("name"),
    releaseYear: integer("release_year"),
});