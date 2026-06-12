import { integer, sqliteTable } from "void/schema-d1";

export const slideReactions = sqliteTable("slide_reactions", {
  count: integer("count").notNull().default(0),
  slideId: integer("slide_id").primaryKey(),
});
