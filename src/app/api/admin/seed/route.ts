import { NextRequest, NextResponse } from "next/server";
import { seedHomepage } from "./seeders/homepage";

// Registry of available seeders
const seeders: Record<
  string,
  () => Promise<{ success: boolean; message: string; data?: unknown }>
> = {
  homepage: seedHomepage,
};

export async function POST(request: NextRequest) {
  // Verify admin token
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!process.env.ADMIN_SEED_TOKEN) {
    return NextResponse.json(
      { error: "ADMIN_SEED_TOKEN not configured" },
      { status: 500 }
    );
  }

  if (token !== process.env.ADMIN_SEED_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get seeder name from query or body
  const { searchParams } = new URL(request.url);
  let seederName = searchParams.get("seeder");

  if (!seederName) {
    try {
      const body = await request.json();
      seederName = body.seeder;
    } catch {
      // No body provided
    }
  }

  // If no seeder specified, list available seeders
  if (!seederName) {
    return NextResponse.json({
      message: "Available seeders",
      seeders: Object.keys(seeders),
      usage: 'POST /api/admin/seed?seeder=<name> or { "seeder": "<name>" }',
    });
  }

  // Check if seeder exists
  const seeder = seeders[seederName];
  if (!seeder) {
    return NextResponse.json(
      {
        error: `Unknown seeder: ${seederName}`,
        available: Object.keys(seeders),
      },
      { status: 400 }
    );
  }

  try {
    const result = await seeder();
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Seed "${seederName}" failed:`, error);
    return NextResponse.json(
      { error: "Seed failed", seeder: seederName, details: String(error) },
      { status: 500 }
    );
  }
}

// GET to list available seeders
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!process.env.ADMIN_SEED_TOKEN || token !== process.env.ADMIN_SEED_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    seeders: Object.keys(seeders),
    usage: "POST /api/admin/seed?seeder=<name>",
  });
}
