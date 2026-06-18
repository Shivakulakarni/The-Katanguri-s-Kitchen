import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validate a request body against a Zod schema.
 * If validation fails, sends a 400 response with the validation errors.
 * Returns the validated (and potentially transformed) data on success.
 */
export async function validateBody<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  schema: ZodSchema<T>,
): Promise<T | null> {
  try {
    return schema.parse(request.body);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      reply.status(400).send({
        error: 'Validation failed',
        details: errors,
      });
      return null;
    }
    throw err;
  }
}

/**
 * Validate query parameters against a Zod schema.
 */
export async function validateQuery<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  schema: ZodSchema<T>,
): Promise<T | null> {
  try {
    return schema.parse(request.query);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      reply.status(400).send({
        error: 'Invalid query parameters',
        details: errors,
      });
      return null;
    }
    throw err;
  }
}

/**
 * Create a Fastify preHandler that validates the request body.
 * Usage: `{ preHandler: [validateBodyMiddleware(schema)] }`
 */
export function validateBodyMiddleware<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await validateBody(request, reply, schema);
    if (result === null) {
      // reply was already sent by validateBody
      return reply;
    }
    (request as any).validatedBody = result;
  };
}
