import 'dotenv/config'
import { Prisma, PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import express from 'express'

const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter: pool })

const app = express()

app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'Node.js API', version: '1.0.0' })
})

app.get('/instance-info', async (req, res) => {
  const os = await import('os')
  res.json({
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
    freeMemory: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
    uptime: `${Math.round(os.uptime())}s`,
    networkInterfaces: Object.entries(os.networkInterfaces())
      .flatMap(([name, interfaces]) => 
        interfaces?.filter(i => i.family === 'IPv4').map(i => ({ name, address: i.address })) || []
      ),
    podName: process.env.HOSTNAME || 'unknown',
  })
})

app.get('/cpu-stress', async (req, res) => {
  const duration = Number(req.query.duration) || 5 // seconds
  const startTime = Date.now()
  
  // CPU-intensive calculation
  while (Date.now() - startTime < duration * 1000) {
    // Fibonacci calculation to burn CPU
    let a = 0, b = 1
    for (let i = 0; i < 10000000; i++) {
      const temp = a + b
      a = b
      b = temp
    }
  }
  
  res.json({
    message: `CPU stress completed`,
    duration: `${duration}s`,
    podName: process.env.HOSTNAME || 'unknown',
  })
})

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() })
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: 'Database connection failed' })
  }
})

app.post(`/signup`, async (req, res) => {
  const { name, email, posts } = req.body

  const postData = posts?.map((post: Prisma.PostCreateInput) => {
    return { title: post?.title, content: post?.content }
  })

  const result = await prisma.user.create({
    data: {
      name,
      email,
      posts: {
        create: postData,
      },
    },
  })
  res.json(result)
})

app.post(`/post`, async (req, res) => {
  const { title, content, authorEmail } = req.body
  const result = await prisma.post.create({
    data: {
      title,
      content,
      author: { connect: { email: authorEmail } },
    },
  })
  res.json(result)
})

app.put('/post/:id/views', async (req, res) => {
  const { id } = req.params

  try {
    const post = await prisma.post.update({
      where: { id: Number(id) },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    })

    res.json(post)
  } catch (error) {
    res.json({ error: `Post with ID ${id} does not exist in the database` })
  }
})

app.put('/publish/:id', async (req, res) => {
  const { id } = req.params

  try {
    const postData = await prisma.post.findUnique({
      where: { id: Number(id) },
      select: {
        published: true,
      },
    })

    const updatedPost = await prisma.post.update({
      where: { id: Number(id) || undefined },
      data: { published: !postData?.published },
    })
    res.json(updatedPost)
  } catch (error) {
    res.json({ error: `Post with ID ${id} does not exist in the database` })
  }
})

app.delete(`/post/:id`, async (req, res) => {
  const { id } = req.params
  const post = await prisma.post.delete({
    where: {
      id: Number(id),
    },
  })
  res.json(post)
})

app.get('/users', async (req, res) => {
  const users = await prisma.user.findMany()
  res.json(users)
})

app.get('/user/:id/drafts', async (req, res) => {
  const { id } = req.params

  const drafts = await prisma.post.findMany({
    where: {
      authorId: Number(id),
      published: false,
    },
  })

  res.json(drafts)
})

app.get(`/post/:id`, async (req, res) => {
  const { id }: { id?: string } = req.params

  const post = await prisma.post.findUnique({
    where: { id: Number(id) },
  })
  res.json(post)
})

app.get('/feed', async (req, res) => {
  const { searchString, skip, take, orderBy } = req.query

  const or: Prisma.PostWhereInput = searchString
    ? {
      OR: [
        { title: { contains: searchString as string } },
        { content: { contains: searchString as string } },
      ],
    }
    : {}

  const posts = await prisma.post.findMany({
    where: {
      published: true,
      ...or,
    },
    include: { author: true },
    take: Number(take) || undefined,
    skip: Number(skip) || undefined,
    orderBy: {
      updatedAt: orderBy as Prisma.SortOrder,
    },
  })

  res.json(posts)
})

const server = app.listen(3000, () =>
  console.log(`Server ready at: http://localhost:3000`)
)
