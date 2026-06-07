import { Hono } from "hono";

const app = new Hono()

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
    return c.json({
        message: "/models endpoint is working!"
    });
})

export default app