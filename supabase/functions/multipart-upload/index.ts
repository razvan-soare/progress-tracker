import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "https://esm.sh/@aws-sdk/client-s3@3";
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

// Request types
type MultipartAction = "initiate" | "getPartUrl" | "complete" | "abort";

interface InitiateRequest {
  action: "initiate";
  fileType: FileType;
  fileSize: number;
  contentType: string;
  fileName?: string;
}

interface GetPartUrlRequest {
  action: "getPartUrl";
  uploadId: string;
  objectKey: string;
  partNumber: number;
}

interface CompleteRequest {
  action: "complete";
  uploadId: string;
  objectKey: string;
  parts: Array<{ partNumber: number; etag: string }>;
}

interface AbortRequest {
  action: "abort";
  uploadId: string;
  objectKey: string;
}

type MultipartRequest =
  | InitiateRequest
  | GetPartUrlRequest
  | CompleteRequest
  | AbortRequest;

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
 * Validates the initiate request parameters
 */
function validateInitiateRequest(
  body: InitiateRequest
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
 * Handle initiate multipart upload
 */
async function handleInitiate(
  r2Client: S3Client,
  userId: string,
  body: InitiateRequest
): Promise<Response> {
  // Validate request
  const validation = validateInitiateRequest(body);
  if (!validation.valid) {
    return new Response(JSON.stringify(validation.error), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const bucketName = Deno.env.get("R2_BUCKET_NAME");
  if (!bucketName) {
    return new Response(
      JSON.stringify({ error: "R2_BUCKET_NAME not configured", code: "SERVER_ERROR" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Generate object key
  const objectKey = generateObjectKey(
    userId,
    body.fileType,
    body.contentType,
    body.fileName
  );

  // Create multipart upload
  const command = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: objectKey,
    ContentType: body.contentType,
  });

  const response = await r2Client.send(command);

  if (!response.UploadId) {
    return new Response(
      JSON.stringify({ error: "Failed to create multipart upload", code: "SERVER_ERROR" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({
      uploadId: response.UploadId,
      objectKey,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

/**
 * Handle get part upload URL
 */
async function handleGetPartUrl(
  r2Client: S3Client,
  body: GetPartUrlRequest
): Promise<Response> {
  const { uploadId, objectKey, partNumber } = body;

  if (!uploadId || !objectKey || !partNumber) {
    return new Response(
      JSON.stringify({
        error: "Missing required fields: uploadId, objectKey, partNumber",
        code: "INVALID_REQUEST",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (partNumber < 1 || partNumber > 10000) {
    return new Response(
      JSON.stringify({
        error: "Part number must be between 1 and 10000",
        code: "INVALID_REQUEST",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const bucketName = Deno.env.get("R2_BUCKET_NAME");
  if (!bucketName) {
    return new Response(
      JSON.stringify({ error: "R2_BUCKET_NAME not configured", code: "SERVER_ERROR" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Generate pre-signed URL for part upload
  const command = new UploadPartCommand({
    Bucket: bucketName,
    Key: objectKey,
    UploadId: uploadId,
    PartNumber: partNumber,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, {
    expiresIn: URL_EXPIRATION_SECONDS,
  });

  return new Response(
    JSON.stringify({
      uploadUrl,
      partNumber,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

/**
 * Handle complete multipart upload
 */
async function handleComplete(
  r2Client: S3Client,
  body: CompleteRequest
): Promise<Response> {
  const { uploadId, objectKey, parts } = body;

  if (!uploadId || !objectKey || !parts || !Array.isArray(parts)) {
    return new Response(
      JSON.stringify({
        error: "Missing required fields: uploadId, objectKey, parts",
        code: "INVALID_REQUEST",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (parts.length === 0) {
    return new Response(
      JSON.stringify({
        error: "At least one part is required to complete the upload",
        code: "INVALID_REQUEST",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const bucketName = Deno.env.get("R2_BUCKET_NAME");
  if (!bucketName) {
    return new Response(
      JSON.stringify({ error: "R2_BUCKET_NAME not configured", code: "SERVER_ERROR" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Sort parts by part number
  const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);

  // Complete the multipart upload
  const command = new CompleteMultipartUploadCommand({
    Bucket: bucketName,
    Key: objectKey,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: sortedParts.map((part) => ({
        PartNumber: part.partNumber,
        ETag: part.etag,
      })),
    },
  });

  await r2Client.send(command);

  return new Response(
    JSON.stringify({
      success: true,
      objectKey,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

/**
 * Handle abort multipart upload
 */
async function handleAbort(
  r2Client: S3Client,
  body: AbortRequest
): Promise<Response> {
  const { uploadId, objectKey } = body;

  if (!uploadId || !objectKey) {
    return new Response(
      JSON.stringify({
        error: "Missing required fields: uploadId, objectKey",
        code: "INVALID_REQUEST",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const bucketName = Deno.env.get("R2_BUCKET_NAME");
  if (!bucketName) {
    return new Response(
      JSON.stringify({ error: "R2_BUCKET_NAME not configured", code: "SERVER_ERROR" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Abort the multipart upload
  const command = new AbortMultipartUploadCommand({
    Bucket: bucketName,
    Key: objectKey,
    UploadId: uploadId,
  });

  await r2Client.send(command);

  return new Response(
    JSON.stringify({
      success: true,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
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
    let body: MultipartRequest;
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

    // Validate action
    const validActions: MultipartAction[] = ["initiate", "getPartUrl", "complete", "abort"];
    if (!body.action || !validActions.includes(body.action)) {
      return new Response(
        JSON.stringify({
          error: `Invalid action. Must be one of: ${validActions.join(", ")}`,
          code: "INVALID_ACTION",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create R2 client
    const r2Client = createR2Client();

    // Handle each action
    switch (body.action) {
      case "initiate":
        return await handleInitiate(r2Client, userId, body as InitiateRequest);
      case "getPartUrl":
        return await handleGetPartUrl(r2Client, body as GetPartUrlRequest);
      case "complete":
        return await handleComplete(r2Client, body as CompleteRequest);
      case "abort":
        return await handleAbort(r2Client, body as AbortRequest);
      default:
        return new Response(
          JSON.stringify({
            error: "Unknown action",
            code: "INVALID_ACTION",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }
  } catch (error) {
    console.error("Error in multipart upload handler:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({
        error: `Multipart upload operation failed: ${errorMessage}`,
        code: "SERVER_ERROR",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
