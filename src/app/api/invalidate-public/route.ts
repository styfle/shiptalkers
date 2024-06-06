import { revalidatePath } from "next/cache";
import { getPageUrl } from "../../../lib/utils";
import { db } from "../../../server/db";
import { users } from "../../../server/db/schema";
import { and, eq } from "drizzle-orm";
import { deleteGithubContribtionsCache, deleteGithubMetadataCache } from "../../../server/lib/github";
import { deleteTwitterProfileCache } from "../../../server/lib/twitter";
import { rateLimiter } from "../../../server/lib/cache";
import { NextRequest } from "next/server";

// queryParams: github, twitter
export async function POST(req: NextRequest) {

    const parsed = new URL(req.url).searchParams;
    const github = parsed.get("github");
    const twitter = parsed.get("twitter");
    const reset = parsed.get("reset");
    if (!github || !twitter) {
        return new Response("Missing parameters", { status: 400 });
    }
    // get ip    
    const ip = `${github}-${twitter}-rate-limit`
    try {
        await rateLimiter.consume(ip, 1)
    } catch (error) {
        console.error(`Rate limited ${github} ${twitter} ${ip} ${error}`)
        return new Response("Rate limited", { status: 429 });
    }
    if (reset) {
        console.log(`Manually resetting ${github} ${twitter}`)
        // yes i know about Promise.all
        await db.delete(users).where(and(eq(users.twitterName, twitter), eq(users.githubName, github)))
        await deleteGithubContribtionsCache(github)
        await deleteGithubMetadataCache(github)
        await deleteTwitterProfileCache(twitter)
    }
    revalidatePath(getPageUrl({
        github,
        twitter,
    }))
    return Response.json({ revalidated: true, now: Date.now() })
}
