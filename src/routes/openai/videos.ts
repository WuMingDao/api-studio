import { Hono } from "hono";
import { env } from "../../data/env.ts";

const app = new Hono()

const BASE_URL = env.OPENAI_VIDEO_BASE_URL;
const API_KEY = env.OPENAI_VIDEO_KEY;

app.post('/videos', async (c) => {
    return c.json({
        message: "/videos endpoint is working!"
    });
})

app.get('/videos/:taskId', async (c) => {
    return c.json({
        message: "/videos/:taskId endpoint is working!"
    });
})

app.get('/videos/:taskId/content', async (c) => {
    return c.json({
        message: "/videos/:taskId/content endpoint is working!"
    });
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