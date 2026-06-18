import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { writeFile, mkdir, stat } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'dishes');

export async function uploadRoutes(app: FastifyInstance) {
  await mkdir(UPLOAD_DIR, { recursive: true });

  app.post('/api/v1/admin/upload/dish-image', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    try {
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: 'No file provided' });
      }

      const ext = file.filename.split('.').pop() || 'jpg';
      const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
      if (!allowedExts.includes(ext.toLowerCase())) {
        return reply.status(400).send({ error: `Invalid file type. Allowed: ${allowedExts.join(', ')}` });
      }

      const maxSize = 5 * 1024 * 1024;
      const chunks: Buffer[] = [];
      let totalSize = 0;

      for await (const chunk of file.file) {
        totalSize += chunk.length;
        if (totalSize > maxSize) {
          return reply.status(400).send({ error: 'File too large. Max size: 5MB' });
        }
        chunks.push(chunk);
      }

      const filename = `${randomUUID()}.${ext}`;
      const filepath = join(UPLOAD_DIR, filename);
      await writeFile(filepath, Buffer.concat(chunks));

      const imageUrl = `/api/v1/uploads/dishes/${filename}`;
      return { imageUrl, filename };
    } catch (err) {
      logger.error({ err }, 'Upload failed');
      return reply.status(500).send({ error: 'Upload failed' });
    }
  });

  app.get('/api/v1/uploads/dishes/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return reply.status(400).send({ error: 'Invalid filename' });
    }
    try {
      const filepath = join(UPLOAD_DIR, filename);
      const fileStat = await stat(filepath);
      
      const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
      const contentTypes: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        webp: 'image/webp', gif: 'image/gif',
      };

      reply.header('Content-Type', contentTypes[ext] || 'image/jpeg');
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      reply.header('Content-Length', fileStat.size);
      
      const stream = createReadStream(filepath);
      return reply.send(stream);
    } catch {
      return reply.status(404).send({ error: 'Image not found' });
    }
  });
}
