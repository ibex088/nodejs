// Prisma config for runtime (migrations, db push, etc.)
module.exports = {
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
};
