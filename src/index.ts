import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import videoRoute from './routes/openai/videos.ts'
import { env } from './data/env.ts'
import { cors } from 'hono/cors'

const app = new Hono()

app.use(cors(
  {
    origin: env.CORS_ORIGIN,
  },
))

app.get('/', (c) => {
  return c.text('Success!')
})

app.route("/v1", videoRoute)

serve({
  fetch: app.fetch,
  port: env.PORT,
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
