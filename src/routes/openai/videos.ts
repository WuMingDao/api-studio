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
   const id = c.req.param("taskId");
  const res = await fetch(`${BASE_URL}/videos/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const json = await res.json();
  console.log(json);

  return c.redirect(json.video_url);
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