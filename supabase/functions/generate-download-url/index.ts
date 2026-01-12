import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3Client, GetObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3";

// Pre-signed URL expiration time (1 hour for downloads)
const URL_EXPIRATION_SECONDS = 60 * 60;

// CORS headers for the response
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface DownloadRequest {
  objectKey: string;
}

interface DownloadResponse {
  downloadUrl: string;
  expiresIn: number;
}

interface ErrorResponse {
  error: string;
  code: string;
}

/**
 * Creates an S3 client configured for Cloudflare R2
 */
function createR2Client(): S3Client {
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const endpoint = Deno.env.get("R2_ENDPOINT");

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error("R2 credentials not configured");
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Generates a pre-signed GET URL for downloading from R2
 */
async function generatePresignedDownloadUrl(
  client: S3Client,
  objectKey: string
): Promise<string> {
  const bucketName = Deno.env.get("R2_BUCKET_NAME");

  if (!bucketName) {
    throw new Error("R2_BUCKET_NAME not configured");
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
  });

  return getSignedUrl(client, command, {
    expiresIn: URL_EXPIRATION_SECONDS,
  });
}

/**
 * Verifies the authorization token and returns the user
 */
async function verifyAuth(
  authHeader: string | null
): Promise<{ userId: string } | { error: ErrorResponse }> {
  if (!authHeader) {
    return {
      error: {
        error: "Missing authorization header",
        code: "UNAUTHORIZED",
      },
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      error: {
        error: "Server configuration error",
        code: "SERVER_ERROR",
      },
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Extract the token from the Bearer header
  const token = authHeader.replace("Bearer ", "");

  // Verify the JWT and get the user
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return {
      error: {
        error: "Invalid or expired token",
        code: "UNAUTHORIZED",
      },
    };
  }

  return { userId: user.id };
}

/**
 * Validates that the user has access to the requested object
 * Objects are stored as: {type}s/{userId}/{timestamp}-{id}.{ext}
 */
function validateObjectAccess(objectKey: string, userId: string): boolean {
  // Extract the user ID from the object key
  const parts = objectKey.split("/");
  if (parts.length < 2) {
    return false;
  }

  // Object key format: {type}s/{userId}/{filename}
  const objectUserId = parts[1];
  return objectUserId === userId;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed",
        code: "METHOD_NOT_ALLOWED",
      }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Verify authentication
    const authResult = await verifyAuth(req.headers.get("authorization"));
    if ("error" in authResult) {
      return new Response(JSON.stringify(authResult.error), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId } = authResult;

    // Parse request body
    let body: DownloadRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: "Invalid JSON body",
          code: "INVALID_REQUEST",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate object key
    if (!body.objectKey || typeof body.objectKey !== "string") {
      return new Response(
        JSON.stringify({
          error: "Missing or invalid objectKey",
          code: "INVALID_REQUEST",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate user has access to this object
    if (!validateObjectAccess(body.objectKey, userId)) {
      return new Response(
        JSON.stringify({
          error: "Access denied to this resource",
          code: "FORBIDDEN",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create R2 client and generate pre-signed URL
    const r2Client = createR2Client();
    const downloadUrl = await generatePresignedDownloadUrl(
      r2Client,
      body.objectKey
    );

    // Return the pre-signed URL
    const response: DownloadResponse = {
      downloadUrl,
      expiresIn: URL_EXPIRATION_SECONDS,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating download URL:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({
        error: `Failed to generate download URL: ${errorMessage}`,
        code: "SERVER_ERROR",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
