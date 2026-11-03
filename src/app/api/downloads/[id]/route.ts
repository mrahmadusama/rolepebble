import { readFile, unlink } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { contentDisposition } from "@/lib/file-name";
import { getJob } from "@/lib/jobs/runner";
import { userDownloadsDir, zipPdfsJob } from "@/lib/jobs/zip-pdfs";
import { sessionUserId } from "@/lib/db";
import { route } from "@/lib/route";

const GONE = "That download isn't here any more. Start a new one from Settings → Your data.";

/** Hands over the user's finished "Download all PDFs" zip (E10-5) once, then removes it from the server. */
export const GET = route<RouteContext<"/api/downloads/[id]">>(async (_request, { params }, session) => {
  const { id } = await params;
  const job = await getJob(id);
  const result = job?.type === zipPdfsJob.type && job.status === "DONE" ? zipPdfsJob.result.safeParse(job.result) : null;
  if (!result?.success) return NextResponse.json({ error: GONE }, { status: 404 });

  const file = path.join(userDownloadsDir(sessionUserId(session)), result.data.file);
  const zip = await readFile(file).catch(() => null);
  if (!zip) return NextResponse.json({ error: GONE }, { status: 410 });
  await unlink(file).catch(() => {});
  return new Response(zip, {
    headers: { "content-type": "application/zip", "content-disposition": contentDisposition(result.data.fileName) },
  });
});
