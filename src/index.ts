import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import videoRoute from './routes/openai/videos.ts'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Success!')
})

app.route("/v1", videoRoute)

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
