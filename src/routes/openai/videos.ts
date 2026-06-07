import { Hono } from "hono";
import { env } from "../../data/env.ts";

const app = new Hono()

const BASE_URL = env.OPENAI_VIDEO_BASE_URL;
const API_KEY = env.OPENAI_VIDEO_KEY;

app.post('/videos', async (c) => {
    const body = {
    model: "veo3.1-fast-720p",
    prompt:
      "Continue this video naturally. Keep the same character, outfit, visual style, camera movement, and cinematic lighting. The character keeps running forward smoothly.",
    seconds: "8",
    size: "1280x720",
    // images: [imageDataUrl],
    // video: "https://many-lands-make.loca.lt/videos/video.mp4",
  };
  const res = await fetch(`${BASE_URL}/videos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return c.json(json);
})

app.get('/videos/:taskId', async (c) => {
   const id = c.req.param("taskId");
  const res = await fetch(`${BASE_URL}/videos/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const json = await res.json();
//   console.log(json);

  return c.json(json);
})

app.get('/videos/:taskId/content', async (c) => {
   const taskId = c.req.param("taskId");
  const res = await fetch(`${BASE_URL}/videos/${taskId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const json = await res.json();
  console.log(json);

  const videoUrl = json.video_url;
  const range = c.req.header('Range')
  const videoRes = await fetch(videoUrl, {
    headers: range ? { Range: range } : undefined,
  })
  const headers = new Headers()
  headers.set('Content-Type', videoRes.headers.get('content-type') || 'video/mp4')
  headers.set('Content-Disposition', `inline; filename="${taskId}.mp4"`)
  const contentLength = videoRes.headers.get('content-length')
  const contentRange = videoRes.headers.get('content-range')
  const acceptRanges = videoRes.headers.get('accept-ranges')
  if (contentLength) headers.set('Content-Length', contentLength)
  if (contentRange) headers.set('Content-Range', contentRange)
  if (acceptRanges) headers.set('Accept-Ranges', acceptRanges)
  return new Response(videoRes.body, {
    status: videoRes.status,
    headers,
  })

})

app.get('/models', async (c) => {
   const data =  await fetch(`${BASE_URL}/models`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        }
   })

   const json = await data.json();

   return c.json(json);
})

export default app