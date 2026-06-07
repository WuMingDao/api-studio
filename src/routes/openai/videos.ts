import { Hono } from "hono";
import { env } from "../../data/env.ts";
import z from "zod";
import { sValidator } from '@hono/standard-validator'


const app = new Hono()

const BASE_URL = env.OPENAI_VIDEO_BASE_URL;
const API_KEY = env.OPENAI_VIDEO_KEY;

const fileSchema = z
  .instanceof(File)
  .refine((file) => file.size > 0, "参考图不能为空")
  .refine((file) => file.type.startsWith("image/"), "input_reference[] 只支持图片文件")
  .refine((file) => file.size <= 30 * 1024 * 1024, "单张参考图不能超过 30MB");
const generateVideoSchema = z.object({
  model: z.string().min(1, "model 不能为空"),
  prompt: z.string().min(1, "prompt 不能为空"),
  seconds: z.string().min(1, "seconds 不能为空"),
  size: z
    .enum(["1280x720", "720x1280", "1792x1024", "1024x1792", "1920x1080"])
    .optional(),
  resolution_name: z.enum(["480p", "720p", "1080p"]).optional(),
  preset: z.enum(["fast", "standard", "slow", "normal"]).optional(),
  /**
   * 前端传来的 input_reference[]，这里归一化成 input_reference
   * 可以不传，所以 default([])
   */
  input_reference: z.array(fileSchema).max(9, "参考图最多 9 张").default([]),
});

async function fileToDataUrl(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);

  return `data:${file.type || "image/png"};base64,${base64}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  /**
   * Node.js / Bun 环境
   */
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64");
  }

  /**
   * Cloudflare Workers / 浏览器类环境
   */
  let binary = "";
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

app.post("/videos", async (c) => {
  const authorization = c.req.header("Authorization");
  if (!authorization) {
    return c.json({ error: "缺少 Authorization" }, 401);
  }
  /**
   * 前端传的是 multipart/form-data，所以这里不能用 valid("json")
   */
  const formData = await c.req.formData();
  /**
   * 兼容 input_reference 和 input_reference[]
   */
  const inputReferences = [
    ...formData.getAll("input_reference"),
    ...formData.getAll("input_reference[]"),
  ].filter((item): item is File => item instanceof File);
  const payload = {
    model: formData.get("model"),
    prompt: formData.get("prompt"),
    seconds: formData.get("seconds"),
    size: formData.get("size") || undefined,
    resolution_name: formData.get("resolution_name") || undefined,
    preset: formData.get("preset") || undefined,
    input_reference: inputReferences,
  };
  const parsed = generateVideoSchema.safeParse(payload);
  if (!parsed.success) {
    return c.json(
      {
        data: {},
        error: parsed.error.issues,
        success: false,
      },
      400,
    );
  }
  const body = parsed.data;
  /**
   * 把 input_reference[] 文件转成 imageDataUrl
   */
  const images = await Promise.all(
    body.input_reference.map((file) => fileToDataUrl(file)),
  );
  /**
   * 上游真实需要的 JSON body
   */
  const upstreamBody: Record<string, unknown> = {
    model: body.model,
    prompt: body.prompt,
    seconds: body.seconds,
    images,
  };
  if (body.size) {
    upstreamBody.size = body.size;
  }
  if (body.resolution_name) {
    upstreamBody.resolution_name = body.resolution_name;
  }
  if (body.preset) {
    upstreamBody.preset = body.preset;
  }
  const res = await fetch(`${BASE_URL}/videos`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(upstreamBody),
  });
  const json = await res.json();
  return c.json(json, res.status as any);
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readStatus(payload: any) {
  return String(payload?.status || payload?.data?.status || "").toLowerCase();
}

function isDone(status: string) {
  return ["completed", "failed", "cancelled", "expired", "succeeded"].includes(status);
}

app.get("/videos/:taskId", async (c) => {
  const authorization = c.req.header("Authorization");
  if (!authorization) {
    return c.json({ error: { message: "缺少 Authorization" } }, 401);
  }

  const id = c.req.param("taskId");
  const startedAt = Date.now();
  const holdMs = 24000;
  const upstreamPollMs = 3000;

  let lastJson: any = { id, status: "pending" };

  while (Date.now() - startedAt < holdMs) {
    const res = await fetch(`${BASE_URL}/videos/${id}`, {
      method: "GET",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
    });

    const json = await res.json();
    lastJson = json;

    const status = readStatus(json);

    if (isDone(status)) {
      return c.json(json);
    }

    await sleep(upstreamPollMs);
  }

  return c.json(lastJson);
});

app.get('/videos/:taskId/content', async (c) => {
  const authorization = c.req.header("Authorization");
  if (!authorization) {
    return c.json({ error: "缺少 Authorization" }, 401);
  }

   const taskId = c.req.param("taskId");
  /**
   * 1. 查询任务，拿到 video_url
   */
  const taskRes = await fetch(`${BASE_URL}/videos/${taskId}`, {
    method: "GET",
    headers: {
      Authorization: authorization,
      Accept: "application/json",
    },
  });
  if (!taskRes.ok) {
    const text = await taskRes.text().catch(() => "");
    return c.json(
      {
        error: "获取视频任务失败",
        detail: text,
      },
      taskRes.status as any,
    );
  }
  const json = await taskRes.json();
  console.log("video task:", json);
  const videoUrl =
    json.video_url ||
    json.videoUrl ||
    json.data?.video_url ||
    json.data?.videoUrl ||
    json.output?.video_url ||
    json.output?.videoUrl;
  if (!videoUrl) {
    return c.json(
      {
        error: "视频还未生成完成或 video_url 不存在",
        status: json.status || json.state,
        detail: json,
      },
      202,
    );
  }
  /**
   * 2. 透传 Range，前端 video 标签拖动进度条需要这个
   */
  const range = c.req.header("Range");
  const videoRes = await fetch(videoUrl, {
    method: "GET",
    headers: range
      ? {
          Range: range,
        }
      : undefined,
  });
  if (!videoRes.ok && videoRes.status !== 206) {
    const text = await videoRes.text().catch(() => "");
    return c.json(
      {
        error: "获取视频内容失败",
        detail: text,
      },
      videoRes.status as any,
    );
  }
  /**
   * 3. 设置视频响应头
   */
  const headers = new Headers();
  headers.set(
    "Content-Type",
    videoRes.headers.get("content-type") || "video/mp4",
  );
  headers.set("Content-Disposition", `inline; filename="${taskId}.mp4"`);
  /**
   * 这些 header 很关键：
   * - Content-Length: 前端知道文件大小
   * - Content-Range: 支持分段播放
   * - Accept-Ranges: 告诉浏览器支持拖动
   */
  const contentLength = videoRes.headers.get("content-length");
  const contentRange = videoRes.headers.get("content-range");
  const acceptRanges = videoRes.headers.get("accept-ranges");
  const cacheControl = videoRes.headers.get("cache-control");
  const etag = videoRes.headers.get("etag");
  const lastModified = videoRes.headers.get("last-modified");
  if (contentLength) headers.set("Content-Length", contentLength);
  if (contentRange) headers.set("Content-Range", contentRange);
  if (acceptRanges) {
    headers.set("Accept-Ranges", acceptRanges);
  } else {
    headers.set("Accept-Ranges", "bytes");
  }
  if (cacheControl) headers.set("Cache-Control", cacheControl);
  else headers.set("Cache-Control", "public, max-age=3600");
  if (etag) headers.set("ETag", etag);
  if (lastModified) headers.set("Last-Modified", lastModified);
  /**
   * 如果前后端跨域，这个也很重要。
   * 否则浏览器拿不到 Content-Range 等头。
   */
  headers.set(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Accept-Ranges, Content-Type",
  );
  return new Response(videoRes.body, {
    status: videoRes.status,
    headers,
  });

})

app.get('/models', async (c) => {
  const authorization = c.req.header("Authorization");
  if (!authorization) {
    return c.json({ error: "缺少 Authorization" }, 401);
  }

   const data =  await fetch(`${BASE_URL}/models`, {
        method: 'GET',
        headers: {
            'Authorization': authorization,
            'Content-Type': 'application/json'
        }
   })

   const json = await data.json();

   return c.json(json);
})

export default app