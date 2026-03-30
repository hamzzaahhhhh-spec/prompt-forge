import { NextRequest, NextResponse } from "next/server";

import {
  getAdminSnapshot,
  updateAdminConfig,
} from "@/lib/admin/realtime";

export const runtime = "edge";

type UpdateBody = {
  maintenanceMode?: boolean;
  forceLocalOnly?: boolean;
};

function isAuthorized(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_ACCESS_KEY?.trim();
  if (!adminKey) {
    return false;
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7).trim();
  return token.length > 0 && token === adminKey;
}

function unauthorized() {
  return NextResponse.json(
    {
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or missing admin key.",
      },
    },
    { status: 401 },
  );
}

function missingAdminKeyConfig() {
  return NextResponse.json(
    {
      error: {
        code: "ADMIN_KEY_NOT_CONFIGURED",
        message: "ADMIN_ACCESS_KEY is not configured on the server.",
      },
    },
    { status: 503 },
  );
}

export async function GET(request: NextRequest) {
  if (!process.env.ADMIN_ACCESS_KEY?.trim()) {
    return missingAdminKeyConfig();
  }

  if (!isAuthorized(request)) {
    return unauthorized();
  }

  return NextResponse.json(getAdminSnapshot(), { status: 200 });
}

export async function POST(request: NextRequest) {
  if (!process.env.ADMIN_ACCESS_KEY?.trim()) {
    return missingAdminKeyConfig();
  }

  if (!isAuthorized(request)) {
    return unauthorized();
  }

  let body: UpdateBody;

  try {
    body = (await request.json()) as UpdateBody;
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
        },
      },
      { status: 400 },
    );
  }

  const next: UpdateBody = {};

  if (typeof body.maintenanceMode === "boolean") {
    next.maintenanceMode = body.maintenanceMode;
  }

  if (typeof body.forceLocalOnly === "boolean") {
    next.forceLocalOnly = body.forceLocalOnly;
  }

  updateAdminConfig(next);

  return NextResponse.json(getAdminSnapshot(), { status: 200 });
}
