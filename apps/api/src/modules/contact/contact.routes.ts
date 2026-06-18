import { FastifyInstance } from 'fastify';
import { sendContactForm } from '../../services/email.service.js';

export async function contactRoutes(app: FastifyInstance) {
  app.post('/api/v1/contact', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'email', 'message'],
        properties: {
          name: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
          subject: { type: 'string' },
          message: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (request) => {
    const { name, email, subject, message } = request.body as any;
    request.log.info({ name, email, subject }, 'Contact form submission');
    
    if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'SG.CHANGE_ME') {
      try {
        await sendContactForm(name, email, subject, message);
      } catch (err: any) {
        request.log.error({ err: err.message }, 'Failed to send contact form email');
      }
    }
    
    return { success: true, message: 'Thank you for your message. We will get back to you soon.' };
  });
}
