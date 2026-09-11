const fs = require('fs');
const crypto = require('crypto');
const { Readable } = require('stream');
const {
  S3Client,
  HeadBucketCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand
} = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { validateVideoFile } = require('./videoValidator.util');
const { validatePdfFile } = require('./pdfValidator.util');

const signedUrlCache = new Map();
let cachedClient = null;
let verifiedBucket = null;

function getConfig() {
  const accountId = String(process.env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = String(process.env.R2_BUCKET || '').trim();
  const endpoint = String(process.env.R2_ENDPOINT || '').trim()
    || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

  return { accountId, accessKeyId, secretAccessKey, bucket, endpoint };
}

function assertConfigured() {
  const config = getConfig();
  const missing = [];
  if (!config.accountId && !process.env.R2_ENDPOINT) missing.push('R2_ACCOUNT_ID');
  if (!config.accessKeyId) missing.push('R2_ACCESS_KEY_ID');
  if (!config.secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
  if (!config.bucket) missing.push('R2_BUCKET');
  if (missing.length) {
    const error = new Error(`Thiếu cấu hình Cloudflare R2: ${missing.join(', ')}`);
    error.code = 'R2_NOT_CONFIGURED';
    throw error;
  }
  return config;
}

function getClient() {
  const config = assertConfigured();
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      maxAttempts: Number(process.env.R2_MAX_ATTEMPTS || 3)
    });
  }
  return cachedClient;
}

function resolveBucket() {
  return assertConfigured().bucket;
}

function getLegacySupabase() {
  const client = require('../config/supabase');
  return client.supabaseAdmin || client;
}

function cleanObjectKey(objectKey) {
  const key = String(objectKey || '').replace(/^\/+/, '');
  if (!key || key.includes('\0') || key.split('/').some(part => part === '..')) {
    const error = new Error('Object key R2 không hợp lệ');
    error.code = 'INVALID_OBJECT_KEY';
    throw error;
  }
  return key;
}

function getInputDetails(fileInput) {
  if (Buffer.isBuffer(fileInput)) {
    return { body: fileInput, sizeBytes: fileInput.length };
  }
  if (typeof fileInput === 'string' && fs.existsSync(fileInput)) {
    const stat = fs.statSync(fileInput);
    return { body: fs.createReadStream(fileInput), sizeBytes: stat.size };
  }
  return null;
}

function computeSha256(fileInput) {
  const hash = crypto.createHash('sha256');
  if (Buffer.isBuffer(fileInput)) hash.update(fileInput);
  else if (typeof fileInput === 'string' && fs.existsSync(fileInput)) hash.update(fs.readFileSync(fileInput));
  return hash.digest('hex');
}

async function computeSha256Stream(fileInput) {
  if (Buffer.isBuffer(fileInput)) return computeSha256(fileInput);
  if (typeof fileInput !== 'string' || !fs.existsSync(fileInput)) return null;
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(fileInput)) hash.update(chunk);
  return hash.digest('hex');
}

function isValidMp4(fileInput) {
  try {
    let header;
    if (Buffer.isBuffer(fileInput)) header = fileInput.subarray(0, 16);
    else {
      const fd = fs.openSync(fileInput, 'r');
      header = Buffer.alloc(16);
      fs.readSync(fd, header, 0, 16, 0);
      fs.closeSync(fd);
    }
    return header.length >= 8 && header.toString('ascii', 4, 8) === 'ftyp';
  } catch {
    return false;
  }
}

async function ensureBucketExists() {
  const bucket = resolveBucket();
  if (verifiedBucket === bucket) return true;
  try {
    await getClient().send(new HeadBucketCommand({ Bucket: bucket }));
    verifiedBucket = bucket;
    return true;
  } catch (error) {
    const wrapped = new Error(`Không thể truy cập R2 bucket "${bucket}". Hãy tạo bucket và kiểm tra API token: ${error.message}`);
    wrapped.code = 'R2_BUCKET_UNAVAILABLE';
    throw wrapped;
  }
}

const ensureVideosBucketExists = ensureBucketExists;
const ensureDocumentsBucketExists = ensureBucketExists;

function invalidateSignedUrlCache(filePath) {
  const key = String(filePath || '').replace(/^\/+/, '');
  for (const cacheKey of signedUrlCache.keys()) {
    if (cacheKey.endsWith(`::${key}`)) signedUrlCache.delete(cacheKey);
  }
}

function clearSignedUrlCache() {
  signedUrlCache.clear();
}

async function uploadObject(fileInput, objectKey, contentType = 'application/octet-stream', metadata = {}) {
  try {
    const input = getInputDetails(fileInput);
    if (!input || input.sizeBytes === 0) {
      return { success: false, code: 'FILE_NOT_FOUND', error: 'Không tìm thấy dữ liệu tệp để tải lên.' };
    }

    const maxBytes = Number(process.env.R2_MAX_OBJECT_BYTES || 5 * 1024 * 1024 * 1024);
    if (input.sizeBytes > maxBytes) {
      return { success: false, code: 'FILE_TOO_LARGE', error: `Tệp vượt giới hạn ${maxBytes} bytes.` };
    }

    await ensureBucketExists();
    const bucket = resolveBucket();
    const key = cleanObjectKey(objectKey);
    const checksumSha256 = await computeSha256Stream(fileInput);
    const partSize = Math.max(5 * 1024 * 1024, Number(process.env.R2_MULTIPART_PART_SIZE_BYTES || 64 * 1024 * 1024));

    const uploader = new Upload({
      client: getClient(),
      params: {
        Bucket: bucket,
        Key: key,
        Body: input.body,
        ContentLength: input.sizeBytes,
        ContentType: contentType,
        CacheControl: metadata.cacheControl || 'private, no-store',
        Metadata: {
          sha256: checksumSha256,
          ...(metadata.custom || {})
        }
      },
      queueSize: Math.max(1, Number(process.env.R2_MULTIPART_QUEUE_SIZE || 3)),
      partSize,
      leavePartsOnError: false
    });
    await uploader.done();

    invalidateSignedUrlCache(key);
    return {
      success: true,
      storageProvider: 'r2',
      storageKey: key,
      storageBucket: bucket,
      mimeType: contentType,
      sizeBytes: input.sizeBytes,
      checksumSha256
    };
  } catch (error) {
    return { success: false, code: error.code || 'R2_UPLOAD_ERROR', error: error.message };
  }
}

async function uploadVideoToSupabase(fileInput, objectKey, mimeType = 'video/mp4') {
  const validation = await validateVideoFile(fileInput);
  if (!validation.isValid) {
    return { success: false, code: validation.code || 'INVALID_VIDEO', error: validation.message || 'Tệp video không hợp lệ.' };
  }
  return uploadObject(fileInput, objectKey, mimeType);
}

async function uploadDocumentToSupabase(fileInput, objectKey, mimeType = 'application/pdf') {
  const validation = await validatePdfFile(fileInput);
  if (!validation.isValid) {
    return { success: false, code: validation.code || 'INVALID_PDF', error: validation.message || 'Tệp PDF không hợp lệ.' };
  }
  return uploadObject(fileInput, objectKey, mimeType);
}

async function uploadPrivateObject(fileInput, objectKey, _legacyBucketName = null, contentType = 'application/octet-stream') {
  return uploadObject(fileInput, objectKey, contentType);
}

async function checkObjectExists(objectKey, bucketName, storageProvider = 'r2') {
  try {
    const key = cleanObjectKey(objectKey);
    if (storageProvider === 'supabase') {
      const { data, error } = await getLegacySupabase().storage.from(bucketName).createSignedUrl(key, 60);
      return !error && Boolean(data?.signedUrl);
    }
    await getClient().send(new HeadObjectCommand({ Bucket: resolveBucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function deleteStorageObject(objectKey, bucketName, storageProvider = 'r2') {
  try {
    const key = cleanObjectKey(objectKey);
    if (storageProvider === 'supabase') {
      const { error } = await getLegacySupabase().storage.from(bucketName).remove([key]);
      if (error) throw error;
      invalidateSignedUrlCache(key);
      return true;
    }
    await getClient().send(new DeleteObjectCommand({ Bucket: resolveBucket(), Key: key }));
    invalidateSignedUrlCache(key);
    return true;
  } catch (error) {
    console.warn(`[R2] Không thể xóa object ${objectKey}:`, error.message);
    return false;
  }
}

async function generateSignedUrl(filePath, bucketName, expiresIn = 900, storageProvider = 'r2') {
  try {
    if (!filePath) return null;
    if (/^https?:\/\//i.test(filePath)) return filePath;
    if (String(filePath).startsWith('/uploads/')) return null;

    const key = cleanObjectKey(filePath);
    const ttl = Math.min(604800, Math.max(1, Number(expiresIn) || 900));
    if (storageProvider === 'supabase') {
      const { data, error } = await getLegacySupabase().storage.from(bucketName).createSignedUrl(key, ttl);
      if (error) throw error;
      return data?.signedUrl || null;
    }
    const bucket = resolveBucket();
    const isPdf = key.toLowerCase().endsWith('.pdf');
    const cacheKey = `${bucket}::${ttl}::${key}::${isPdf ? 'inline' : 'default'}`;
    const cached = signedUrlCache.get(cacheKey);
    if (cached?.expiresAt > Date.now()) return cached.url;

    const commandInput = { Bucket: bucket, Key: key };
    if (isPdf) {
      commandInput.ResponseContentType = 'application/pdf';
      commandInput.ResponseContentDisposition = 'inline';
    }

    const url = await getSignedUrl(
      getClient(),
      new GetObjectCommand(commandInput),
      { expiresIn: ttl }
    );
    const cacheMs = Math.max(1000, (ttl - Math.min(300, Math.floor(ttl / 10))) * 1000);
    signedUrlCache.set(cacheKey, { url, expiresAt: Date.now() + cacheMs });
    return url;
  } catch (error) {
    console.warn(`[R2] Không thể tạo signed URL cho ${filePath}:`, error.message);
    return null;
  }
}

function toWebReadable(body) {
  if (!body) return null;
  if (typeof body.transformToWebStream === 'function') return body.transformToWebStream();
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) return body;
  if (Readable.isReadable(body)) return Readable.toWeb(body);
  return body;
}

function buildR2Response(output) {
  const headers = new Headers();
  const values = {
    'accept-ranges': output.AcceptRanges,
    'cache-control': output.CacheControl,
    'content-length': output.ContentLength,
    'content-range': output.ContentRange,
    'content-type': output.ContentType,
    etag: output.ETag,
    'last-modified': output.LastModified?.toUTCString?.()
  };
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') headers.set(name, String(value));
  }

  return new Response(toWebReadable(output.Body), {
    status: output.ContentRange ? 206 : 200,
    headers
  });
}

async function fetchPrivateObject(
  filePath,
  bucketName,
  rangeHeader = null,
  storageProvider = 'r2',
  { signal, client } = {}
) {
  if (storageProvider === 'supabase') {
    const signedUrl = await generateSignedUrl(filePath, bucketName, 90, storageProvider);
    if (!signedUrl) return null;
    const headers = rangeHeader ? { Range: rangeHeader } : {};
    return fetch(signedUrl, { method: 'GET', headers, redirect: 'error', ...(signal ? { signal } : {}) });
  }

  const commandInput = {
    Bucket: resolveBucket(),
    Key: cleanObjectKey(filePath),
    ...(rangeHeader ? { Range: rangeHeader } : {})
  };

  try {
    const output = await (client || getClient()).send(
      new GetObjectCommand(commandInput),
      signal ? { abortSignal: signal } : undefined
    );
    return buildR2Response(output);
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw error;
    const status = Number(error?.$metadata?.httpStatusCode);
    if (status === 404 || status === 416) {
      const contentRange = error?.$response?.headers?.['content-range'];
      return new Response(null, {
        status,
        headers: contentRange ? { 'Content-Range': contentRange } : undefined
      });
    }
    throw error;
  }
}

module.exports = {
  getConfig,
  getClient,
  resolveBucket,
  isValidMp4,
  computeSha256,
  computeSha256Stream,
  ensureBucketExists,
  ensureVideosBucketExists,
  ensureDocumentsBucketExists,
  uploadObject,
  uploadVideoToR2: uploadVideoToSupabase,
  uploadDocumentToR2: uploadDocumentToSupabase,
  uploadVideoToSupabase,
  uploadPrivateObject,
  uploadDocumentToSupabase,
  checkObjectExists,
  deleteStorageObject,
  generateSignedUrl,
  fetchPrivateObject,
  invalidateSignedUrlCache,
  clearSignedUrlCache
};
