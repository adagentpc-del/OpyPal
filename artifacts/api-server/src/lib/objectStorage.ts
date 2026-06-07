// Object storage backed by Supabase Storage.
// Replaces the previous Replit Object Storage (GCS sidecar) implementation so
// the app runs on standard hosting (Render). The public API used by
// routes/storage.ts is preserved: getObjectEntityUploadURL,
// normalizeObjectEntityPath, getObjectEntityFile, searchPublicObject,
// downloadObject (plus ACL-compat stubs). Object-level access control is
// enforced at the route layer via the campaign_assets table, so the previous
// custom-metadata ACL system is no longer needed here.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "opypal-uploads";

let _client: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (!_client) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use file storage.",
      );
    }
    _client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// Lightweight descriptor that replaces the GCS `File` object. Routes treat the
// return values of searchPublicObject / getObjectEntityFile as opaque handles
// passed back into downloadObject.
export interface StoredObject {
  path: string;
}

export class ObjectStorageService {
  constructor() {}

  // Create a one-time signed upload URL. The client PUTs the file body directly
  // to this URL (compatible with the existing frontend upload flow).
  async getObjectEntityUploadURL(): Promise<string> {
    const objectPath = `uploads/${randomUUID()}`;
    const { data, error } = await client()
      .storage.from(BUCKET)
      .createSignedUploadUrl(objectPath);
    if (error || !data) {
      throw new Error(
        `Failed to create signed upload URL: ${error?.message ?? "unknown error"}`,
      );
    }
    return data.signedUrl;
  }

  // Turn a Supabase signed upload URL into our canonical "/objects/<path>" form
  // that gets stored on the asset record and later served.
  normalizeObjectEntityPath(rawPath: string): string {
    try {
      const url = new URL(rawPath);
      const marker = `/${BUCKET}/`;
      const idx = url.pathname.indexOf(marker);
      if (idx !== -1) {
        const objectPath = url.pathname.slice(idx + marker.length);
        return `/objects/${objectPath}`;
      }
    } catch {
      // not a URL — fall through
    }
    return rawPath;
  }

  async getObjectEntityFile(objectPath: string): Promise<StoredObject> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const path = objectPath.slice("/objects/".length);
    if (!path) {
      throw new ObjectNotFoundError();
    }
    return { path };
  }

  // Public assets live under a "public/" prefix in the bucket.
  async searchPublicObject(filePath: string): Promise<StoredObject | null> {
    const path = `public/${filePath}`.replace(/\/+/g, "/");
    const lastSlash = path.lastIndexOf("/");
    const dir = path.slice(0, lastSlash);
    const name = path.slice(lastSlash + 1);
    const { data } = await client()
      .storage.from(BUCKET)
      .list(dir, { search: name, limit: 100 });
    if (data && data.some((f) => f.name === name)) {
      return { path };
    }
    return null;
  }

  async downloadObject(
    obj: StoredObject,
    cacheTtlSec: number = 3600,
  ): Promise<Response> {
    const { data, error } = await client().storage.from(BUCKET).download(obj.path);
    if (error || !data) {
      throw new ObjectNotFoundError();
    }
    const arrayBuffer = await data.arrayBuffer();
    const headers: Record<string, string> = {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": `private, max-age=${cacheTtlSec}`,
      "Content-Length": String(arrayBuffer.byteLength),
    };
    return new Response(arrayBuffer, { headers });
  }

  // --- Compatibility shims (ACL now enforced at the route/DB layer) ---

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    _aclPolicy: unknown,
  ): Promise<string> {
    return this.normalizeObjectEntityPath(rawPath);
  }

  async canAccessObjectEntity(_args: {
    userId?: string;
    objectFile: StoredObject;
    requestedPermission?: unknown;
  }): Promise<boolean> {
    return true;
  }
}
