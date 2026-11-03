import { NextResponse } from "next/server";

import { sessionUserId } from "@/lib/db";
import { heldPdf, pdfDownload } from "@/lib/pdf/downloads";
import { route } from "@/lib/route";

const GONE = "That PDF isn't here any more. Download it again.";

/** Hands over a PDF that `POST /api/pdf` rendered and held for a few minutes, to the user it was rendered for. */
export const GET = route<RouteContext<"/api/pdf/[id]">>(async (_request, { params }, session) => {
  const held = heldPdf((await params).id, sessionUserId(session));
  return held ? pdfDownload(held.pdf, held.fileName) : NextResponse.json({ error: GONE }, { status: 404 });
});
