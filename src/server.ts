import "dotenv/config";
import app from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";

const PORT = process.env.PORT || env.PORT;

const server = app.listen(PORT, () => {
  console.log(`VirtualLab backend running on port ${PORT}`);
});

const shutdown = async () => {
  try {
    await prisma.$disconnect();
  } catch (err) {
    console.error("Error during Prisma disconnect:", err);
  }

  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);