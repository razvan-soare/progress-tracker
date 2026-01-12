import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3";

// File type configurations with size limits
const FILE_TYPE_CONFIG = {
  video: {
    maxSizeBytes: 500 * 1024 * 1024, // 500MB
    allowedContentTypes: [
      "video/mp4",
      "video/quicktime",
      "video/x-m4v",
      "video/webm",
    ],
  },
  photo: {
    maxSizeBytes: 20 * 1024 * 1024, // 20MB
    allowedContentTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ],
  },
} as const;

type FileType = keyof typeof FILE_TYPE_CONFIG;

// Pre-signed URL expiration time (15 minutes)
const URL_EXPIRATION_SECONDS = 15 * 60;

// CORS headers for the response
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface UploadRequest {
  fileType: FileType;
  fileSize: number;
  contentType: string;
  fileName?: string;
}

interface UploadResponse {
  uploadUrl: string;
  objectKey: string;
  expiresIn: number;
}

interface ErrorResponse {
  error: string;
  code: string;
}

/**
 * Generates a unique object key for the upload
 */
function generateObjectKey(
  userId: string,
  fileType: FileType,
  contentType: string,
  fileName?: string
): string {
  const timestamp = Date.now();
  const randomId = crypto.randomUUID();
  const extension = getExtensionFromContentType(contentType, fileName);

  // Structure: {fileType}/{userId}/{timestamp}-{randomId}.{ext}
  return `${fileType}s/${userId}/${timestamp}-${randomId}${extension}`;
}

/**
 * Extracts file extension from content type or filename
 */
function getExtensionFromContentType(
  contentType: string,
  fileName?: string
): string {
  // Try to get extension from filename first
  if (fileName) {
    const parts = fileName.split(".");
    if (parts.length > 1) {
      return `.${parts[parts.length - 1].toLowerCase()}`;
    }
  }

  // Fallback to content type mapping
  const extensionMap: Record<string, string> = {
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/x-m4v": ".m4v",
    "video/webm": ".webm",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
  };

  return extensionMap[contentType] || "";
}

/**
 * Validates the upload request parameters
 */
function validateRequest(
  body: UploadRequest
): { valid: true } | { valid: false; error: ErrorResponse } {
  const { fileType, fileSize, contentType } = body;

  // Check file type is valid
  if (!fileType || !(fileType in FILE_TYPE_CONFIG)) {
    return {
      valid: false,
      error: {
        error: `Invalid file type. Must be one of: ${Object.keys(FILE_TYPE_CONFIG).join(", ")}`,
        code: "INVALID_FILE_TYPE",
      },
    };
  }

  const config = FILE_TYPE_CONFIG[fileType];

  // Check content type is allowed for this file type
  if (
    !contentType ||
    !config.allowedContentTypes.includes(
      contentType as (typeof config.allowedContentTypes)[number]
    )
  ) {
    return {
      valid: false,
      error: {
        error: `Invalid content type for ${fileType}. Allowed types: ${config.allowedContentTypes.join(", ")}`,
        code: "INVALID_CONTENT_TYPE",
      },
    };
  }

  // Check file size
  if (!fileSize || fileSize <= 0) {
    return {
      valid: false,
      error: {
        error: "File size must be a positive number",
        code: "INVALID_FILE_SIZE",
      },
    };
  }

  if (fileSize > config.maxSizeBytes) {
    const maxSizeMB = config.maxSizeBytes / (1024 * 1024);
    return {
      valid: false,
      error: {
        error: `File size exceeds maximum allowed for ${fileType} (${maxSizeMB}MB)`,
        code: "FILE_TOO_LARGE",
      },
    };
  }

  return { valid: true };
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
 * Generates a pre-signed PUT URL for uploading to R2
 */
async function generatePresignedUrl(
  client: S3Client,
  objectKey: string,
  contentType: string,
  fileSize: number
): Promise<string> {
  const bucketName = Deno.env.get("R2_BUCKET_NAME");

  if (!bucketName) {
    throw new Error("R2_BUCKET_NAME not configured");
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    ContentType: contentType,
    ContentLength: fileSize,
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
    let body: UploadRequest;
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

    // Validate request parameters
    const validation = validateRequest(body);
    if (!validation.valid) {
      return new Response(JSON.stringify(validation.error), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate object key
    const objectKey = generateObjectKey(
      userId,
      body.fileType,
      body.contentType,
      body.fileName
    );

    // Create R2 client and generate pre-signed URL
    const r2Client = createR2Client();
    const uploadUrl = await generatePresignedUrl(
      r2Client,
      objectKey,
      body.contentType,
      body.fileSize
    );

    // Return the pre-signed URL
    const response: UploadResponse = {
      uploadUrl,
      objectKey,
      expiresIn: URL_EXPIRATION_SECONDS,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating upload URL:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({
        error: `Failed to generate upload URL: ${errorMessage}`,
        code: "SERVER_ERROR",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
