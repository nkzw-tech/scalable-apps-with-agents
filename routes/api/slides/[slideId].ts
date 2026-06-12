import { slideReactions } from "@schema";
import { defineHandler } from "void";
import { db, eq, sql } from "void/db";

const getSlideId = (rawSlideId: string | undefined) => {
  const slideId = Number(rawSlideId);
  return Number.isInteger(slideId) && slideId >= 0 ? slideId : null;
};

export const GET = defineHandler(async (c) => {
  const slideId = getSlideId(c.req.param("slideId"));
  if (slideId === null) return c.json({ error: "Invalid slide id" }, 400);

  const [reaction] = await db
    .select({ count: slideReactions.count })
    .from(slideReactions)
    .where(eq(slideReactions.slideId, slideId))
    .limit(1);

  return { count: reaction?.count ?? 0 };
});

export const POST = defineHandler(async (c) => {
  const slideId = getSlideId(c.req.param("slideId"));
  if (slideId === null) return c.json({ error: "Invalid slide id" }, 400);

  const [reaction] = await db
    .insert(slideReactions)
    .values({ count: 1, slideId })
    .onConflictDoUpdate({
      set: {
        count: sql`${slideReactions.count} + 1`,
      },
      target: slideReactions.slideId,
    })
    .returning({ count: slideReactions.count });

  return { count: reaction.count };
});
