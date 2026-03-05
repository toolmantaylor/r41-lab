import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ENDPOINT = "https://f9ef070639520e53fe350aa699e4793a.r2.cloudflarestorage.com";
const R2_ACCESS_KEY_ID = "dd68cbae6e500c1a4b012e8fc81206e7";
const R2_SECRET_ACCESS_KEY = "3ffca36ded4dfc61d5ba003e89b51e95e24822e9bb1a46453439833d5352f385";
const BUCKET = "r41-lab";

const r2 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const testKey = `test/presign-test-${Date.now()}.txt`;
const mimeType = "text/plain";

try {
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: testKey, ContentType: mimeType });
  const url = await getSignedUrl(r2, cmd, { expiresIn: 3600 });
  console.log("PRESIGN_URL=" + url);
} catch (e) {
  console.error("Error:", e.message);
}
