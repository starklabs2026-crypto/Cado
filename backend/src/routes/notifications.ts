import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

export function registerNotificationRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/notifications - Get all notifications for the user
  app.fastify.get('/api/notifications', {
    schema: {
      description: 'Get all notifications for the authenticated user',
      tags: ['notifications'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              type: { type: 'string' },
              title: { type: 'string' },
              message: { type: 'string' },
              data: { type: ['object', 'null'] },
              read: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching notifications');

    const notifications = await app.db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, session.user.id))
      .orderBy((notif) => notif.createdAt);

    // Sort by createdAt DESC
    const sorted = notifications.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const result = sorted.map((notif) => ({
      id: notif.id,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      data: notif.data ? JSON.parse(notif.data) : null,
      read: notif.read,
      createdAt: notif.createdAt.toISOString(),
    }));

    app.logger.info({ userId: session.user.id, count: result.length }, 'Notifications retrieved');
    return result;
  });

  // GET /api/notifications/unread-count - Get count of unread notifications
  app.fastify.get('/api/notifications/unread-count', {
    schema: {
      description: 'Get count of unread notifications for the authenticated user',
      tags: ['notifications'],
      response: {
        200: {
          type: 'object',
          properties: {
            count: { type: 'number' },
          },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching unread notification count');

    const notifications = await app.db
      .select()
      .from(schema.notifications)
      .where(
        eq(schema.notifications.userId, session.user.id)
      );

    const unreadCount = notifications.filter((n) => !n.read).length;

    app.logger.info({ userId: session.user.id, count: unreadCount }, 'Unread count retrieved');
    return { count: unreadCount };
  });

  // POST /api/notifications/:id/mark-read - Mark a notification as read
  app.fastify.post<{ Params: { id: string } }>(
    '/api/notifications/:id/mark-read',
    {
      schema: {
        description: 'Mark a notification as read',
        tags: ['notifications'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          403: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      app.logger.info({ userId: session.user.id, notificationId: id }, 'Marking notification as read');

      // Get notification
      const notification = await app.db
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.id, id))
        .limit(1);

      if (notification.length === 0) {
        app.logger.warn({ notificationId: id }, 'Notification not found');
        return reply.status(404).send({ error: 'Notification not found' });
      }

      // Check if notification belongs to the user
      if (notification[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, notificationId: id, ownerId: notification[0].userId },
          'User does not own this notification'
        );
        return reply.status(403).send({ error: 'Forbidden' });
      }

      // Update notification
      await app.db
        .update(schema.notifications)
        .set({ read: true })
        .where(eq(schema.notifications.id, id));

      app.logger.info({ userId: session.user.id, notificationId: id }, 'Notification marked as read');
      return { success: true };
    }
  );
}
