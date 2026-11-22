import { NextResponse } from "next/server";
import fs from "fs";
import { Readable } from "node:stream";
import path from "path";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

const BATCH_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
const UPLOADS_ROOT = path.resolve(process.cwd(), "public", "uploads");
const PUBLIC_ROOT = path.resolve(process.cwd(), "public");

function isPathInside(childPath: string, parentDir: string): boolean {
  const relative = path.relative(parentDir, path.resolve(childPath));
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

interface ResolveResult {
  status: number;
  error?: string;
  code?: string;
  targetFilePath?: string;
}

async function resolvePdfPath(batchIdParam: string, reqUrl: string): Promise<ResolveResult> {
  const batchId = (batchIdParam || "").trim();

  // 1. Strict Batch ID validation
  if (!batchId || !BATCH_ID_REGEX.test(batchId)) {
    return {
      status: 400,
      error: "Format ID batch tidak valid",
      code: "INVALID_REQUEST",
    };
  }

  const url = new URL(reqUrl);
  const typeParam = (url.searchParams.get("type") || "").trim().toLowerCase();
  const rawFileName = (url.searchParams.get("fileName") || "").trim();
  const detailIdParam = url.searchParams.get("detailId");

  // Sanitize fileNameParam: strip directory slashes, null bytes, and traversal '..'
  let safeFileName: string | null = null;
  if (rawFileName) {
    const stripped = path.basename(rawFileName.replace(/\\/g, "/")).replace(/\.\.+/g, "");
    if (stripped) {
      safeFileName = stripped;
    }
  }

  const uploadsDir = path.resolve(UPLOADS_ROOT, batchId);
  if (!isPathInside(uploadsDir, UPLOADS_ROOT)) {
    return {
      status: 403,
      error: "Akses direktori ditolak",
      code: "ACCESS_DENIED",
    };
  }

  let targetFilePath: string | null = null;

  // Strategy A: Direct fileName check within batch directory
  if (safeFileName && (await fileExists(uploadsDir))) {
    const candidate = path.resolve(uploadsDir, safeFileName);
    if (isPathInside(candidate, uploadsDir) && (await fileExists(candidate))) {
      try {
        if (await isFile(candidate)) {
          targetFilePath = candidate;
        }
      } catch {
        // ignore error
      }
    }
  }

  // Strategy B: detailId lookup from database
  if (!targetFilePath && detailIdParam && /^\d+$/.test(detailIdParam)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = await (db as any).detailBatch.findUnique({
        where: { id: Number(detailIdParam) },
      });
      if (detail?.isi) {
        try {
          const isiObj = typeof detail.isi === "string" ? JSON.parse(detail.isi) : detail.isi;
          if (isiObj.fileUrl && typeof isiObj.fileUrl === "string") {
            const relPath = isiObj.fileUrl.replace(/^[/\\]+/, "").replace(/\.\.+/g, "");
            const fullCandidate = path.resolve(PUBLIC_ROOT, relPath);
            if (isPathInside(fullCandidate, PUBLIC_ROOT) && (await fileExists(fullCandidate))) {
              if (await isFile(fullCandidate)) {
                targetFilePath = fullCandidate;
              }
            }
          }
        } catch {
          // ignore JSON parse error
        }
      }
    } catch {
      // ignore DB error
    }
  }

  // Strategy C: Scan batch directory by document type keyword
  if (!targetFilePath && (await fileExists(uploadsDir))) {
    try {
      if (await isDirectory(uploadsDir)) {
        const files = await fs.promises.readdir(uploadsDir);
        for (const f of files) {
          if (!f.toLowerCase().endsWith(".pdf")) continue;
          const fl = f.toLowerCase();
          if (typeParam === "pib" && (fl.startsWith("pib") || fl.includes("pib"))) {
            targetFilePath = path.resolve(uploadsDir, f);
            break;
          } else if (
            (typeParam === "invoice" || typeParam === "inv") &&
            fl.includes("invoice")
          ) {
            targetFilePath = path.resolve(uploadsDir, f);
            break;
          } else if (
            (typeParam === "packing list" || typeParam === "pl") &&
            fl.includes("packing")
          ) {
            targetFilePath = path.resolve(uploadsDir, f);
            break;
          } else if (typeParam === "bl" && (fl.includes("bl") || fl.includes("lading"))) {
            targetFilePath = path.resolve(uploadsDir, f);
            break;
          } else if (typeParam === "ak" && (fl.includes("ak") || fl.includes("coo"))) {
            targetFilePath = path.resolve(uploadsDir, f);
            break;
          } else if (typeParam === "wl" && (fl.includes("wl") || fl.includes("weight"))) {
            targetFilePath = path.resolve(uploadsDir, f);
            break;
          } else if (typeParam === "ms" && (fl.includes("ms") || fl.includes("mill"))) {
            targetFilePath = path.resolve(uploadsDir, f);
            break;
          }
        }
      }
    } catch {
      // ignore read error
    }
  }

  // Strategy D: Fallback to sample directory if configured (only if typeParam matches)
  if (!targetFilePath && typeParam) {
    const sampleDir = path.resolve(UPLOADS_ROOT, "sample");
    if (await fileExists(sampleDir)) {
      try {
        if (await isDirectory(sampleDir)) {
          const sampleFiles = await fs.promises.readdir(sampleDir);
          for (const f of sampleFiles) {
            if (!f.toLowerCase().endsWith(".pdf")) continue;
            const fl = f.toLowerCase();
            if (fl.includes(typeParam)) {
              targetFilePath = path.resolve(sampleDir, f);
              break;
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  if (!targetFilePath || !(await fileExists(targetFilePath))) {
    return {
      status: 404,
      error: "PDF not found",
      code: "PDF_NOT_FOUND",
    };
  }

  if (!isPathInside(targetFilePath, PUBLIC_ROOT)) {
    return {
      status: 403,
      error: "Akses file ditolak",
      code: "ACCESS_DENIED",
    };
  }

  return {
    status: 200,
    targetFilePath,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawBatchId } = await params;
    const result = await resolvePdfPath(rawBatchId, req.url);

    if (result.status === 400) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: 400 }
      );
    }

    if (result.status === 403) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: 403 }
      );
    }

    if (result.status === 404 || !result.targetFilePath) {
      return NextResponse.json(
        {
          error: "PDF not found",
          code: "PDF_NOT_FOUND",
          batchId: rawBatchId,
        },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const stat = await fs.promises.stat(result.targetFilePath);
    const totalSize = stat.size;
    const rangeHeader = req.headers.get("range");

    if (rangeHeader && rangeHeader.startsWith("bytes=")) {
      const match = rangeHeader.replace(/^bytes=/, "").trim();
      const [startStr, endStr] = match.split("-");

      let start = startStr ? parseInt(startStr, 10) : NaN;
      let end = endStr ? parseInt(endStr, 10) : NaN;

      if (isNaN(start)) {
        start = Math.max(0, totalSize - end);
        end = totalSize - 1;
      } else if (isNaN(end)) {
        end = totalSize - 1;
      }

      if (isNaN(start) || isNaN(end) || start < 0 || start > end || start >= totalSize) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${totalSize}`,
            "Accept-Ranges": "bytes",
          },
        });
      }

      if (end >= totalSize) {
        end = totalSize - 1;
      }

      const chunkSize = end - start + 1;
      const fsStream = fs.createReadStream(result.targetFilePath, { start, end });
      const webStream = Readable.toWeb(fsStream) as ReadableStream<Uint8Array>;

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Content-Length": String(chunkSize),
          "Accept-Ranges": "bytes",
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${encodeURIComponent(path.basename(result.targetFilePath))}"`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    const fsStream = fs.createReadStream(result.targetFilePath);
    const webStream = Readable.toWeb(fsStream) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": String(totalSize),
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(path.basename(result.targetFilePath))}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: unknown) {
    console.error("PDF Serve Error:", err);
    return NextResponse.json(
      { error: "Gagal memproses permintaan dokumen PDF", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function HEAD(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawBatchId } = await params;
    const result = await resolvePdfPath(rawBatchId, req.url);

    if (result.status === 400) {
      return new NextResponse(null, { status: 400 });
    }

    if (result.status === 403) {
      return new NextResponse(null, { status: 403 });
    }

    if (result.status === 404 || !result.targetFilePath) {
      return new NextResponse(null, {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const stat = await fs.promises.stat(result.targetFilePath);
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(stat.size),
        "Accept-Ranges": "bytes",
        "Content-Disposition": `inline; filename="${encodeURIComponent(path.basename(result.targetFilePath))}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
