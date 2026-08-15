import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";

// The frontend runs on port 80 and calls the API on 4080, so every response is
// cross-origin. Same header set the Module 7 lab uses.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** Every response uses this shape, so the frontend never has to guess. */
export type Envelope<T> = { data: T | null; error: string | null };

export function preflight() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * The caller's IP, used as a stable-enough client identity since this API has
 * no auth. `x-forwarded-for` first (set by a reverse proxy / Docker's host
 * mapping), falling back to the direct socket address.
 */
function clientIdOf(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}

/**
 * Best-effort feedId for the request, read from whichever query param the
 * route uses (`feedId` on /api/posts, `id` on /api/feeds itself). Not
 * resolved from `?slug=` — that would mean a DB lookup on every single
 * request just for a metrics dimension, which isn't worth the cost.
 */
function feedIdOf(request: NextRequest): number | null {
  const path = request.nextUrl.pathname;
  const raw =
    request.nextUrl.searchParams.get("feedId") ??
    (path.startsWith("/api/feeds") ? request.nextUrl.searchParams.get("id") : null);
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Writes a RequestLog row for every API call. This is what /api/count,
 * /api/stats and Assessment 3's dashboard/alerts all read. Logging must never
 * break the response, so failures here are swallowed.
 */
async function record(
  request: NextRequest,
  status: number,
  startedAt: number,
): Promise<void> {
  try {
    await prisma.requestLog.create({
      data: {
        method: request.method,
        path: request.nextUrl.pathname,
        status,
        durationMs: Date.now() - startedAt,
        clientId: clientIdOf(request),
        feedId: feedIdOf(request),
        outcome: status < 400 ? "ok" : "error",
      },
    });
  } catch {
    // A logging failure is not worth failing the request over.
  }
}

export async function ok<T>(
  request: NextRequest,
  data: T,
  startedAt: number,
  status = 200,
): Promise<NextResponse> {
  await record(request, status, startedAt);
  if (status === 204) {
    return new NextResponse(null, { status, headers: corsHeaders });
  }
  return NextResponse.json<Envelope<T>>(
    { data, error: null },
    { status, headers: corsHeaders },
  );
}

export async function fail(
  request: NextRequest,
  message: string,
  status: number,
  startedAt: number,
): Promise<NextResponse> {
  await record(request, status, startedAt);
  return NextResponse.json<Envelope<never>>(
    { data: null, error: message },
    { status, headers: corsHeaders },
  );
}

/**
 * Parses the `?id=` query parameter the lab's routes use. Returns null when it
 * is absent, and NaN-safe so `?id=abc` is a 400 rather than a database error.
 */
export function readId(request: NextRequest): number | null | "invalid" {
  const raw = request.nextUrl.searchParams.get("id");
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : "invalid";
}

/**
 * The origin the client actually reached this server on. `request.nextUrl.origin`
 * reflects the server's own bind address (e.g. `localhost:3000`, the port `next
 * dev` listens on inside the container) rather than the address behind Docker's
 * port mapping — so absolute URLs built from it are unreachable from outside the
 * container. The `Host` header the client actually sent is reliable instead,
 * since Docker's port mapping is a plain TCP NAT that leaves HTTP headers
 * untouched.
 */
export function requestOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}

/** Narrows an unknown thrown value to a Prisma error code, e.g. P2002/P2025. */
export function prismaErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

/**
 * Maps the Prisma error codes these routes can actually produce onto HTTP.
 * Matching on the stable `code` rather than the message text, which changes
 * between Prisma releases.
 */
export function mapPrismaError(error: unknown): { message: string; status: number } {
  switch (prismaErrorCode(error)) {
    case "P2002":
      return { message: "A record with that unique value already exists", status: 409 };
    case "P2003":
      return { message: "Referenced record does not exist", status: 400 };
    case "P2025":
      return { message: "Record not found", status: 404 };
    default:
      return { message: "Server error", status: 500 };
  }
}
