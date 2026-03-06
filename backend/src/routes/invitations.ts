import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

export function registerInvitationRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/group-invitations/:id/accept - Accept a group invitation
  app.fastify.post<{ Params: { id: string } }>(
    '/api/group-invitations/:id/accept',
    {
      schema: {
        description: 'Accept a group invitation',
        tags: ['invitations'],
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
              groupId: { type: 'string' },
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
      app.logger.info({ userId: session.user.id, invitationId: id }, 'Accepting group invitation');

      // Get invitation
      const invitation = await app.db
        .select()
        .from(schema.groupInvitations)
        .where(eq(schema.groupInvitations.id, id))
        .limit(1);

      if (invitation.length === 0) {
        app.logger.warn({ invitationId: id }, 'Invitation not found');
        return reply.status(404).send({ error: 'Invitation not found' });
      }

      const inv = invitation[0];

      // Check if this invitation is for the current user
      if (inv.invitedUserId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, invitationId: id, invitedUserId: inv.invitedUserId },
          'User not the invitee'
        );
        return reply.status(403).send({ error: 'This invitation is not for you' });
      }

      // Check if invitation is still pending
      if (inv.status !== 'pending') {
        app.logger.warn({ invitationId: id, status: inv.status }, 'Invitation already responded to');
        return reply.status(403).send({ error: 'This invitation has already been responded to' });
      }

      // Add user to group
      await app.db
        .insert(schema.groupMembers)
        .values({
          groupId: inv.groupId,
          userId: session.user.id,
          role: 'member',
        });

      // Update invitation status
      await app.db
        .update(schema.groupInvitations)
        .set({
          status: 'accepted',
          respondedAt: new Date(),
        })
        .where(eq(schema.groupInvitations.id, id));

      // Mark related notification as read
      const notifications = await app.db
        .select()
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.userId, session.user.id),
            eq(schema.notifications.type, 'group_invitation')
          )
        );

      for (const notif of notifications) {
        const data = notif.data ? JSON.parse(notif.data) : {};
        if (data.invitationId === id) {
          await app.db
            .update(schema.notifications)
            .set({ read: true })
            .where(eq(schema.notifications.id, notif.id));
        }
      }

      app.logger.info(
        { userId: session.user.id, invitationId: id, groupId: inv.groupId },
        'Group invitation accepted'
      );
      return { success: true, groupId: inv.groupId };
    }
  );

  // POST /api/group-invitations/:id/reject - Reject a group invitation
  app.fastify.post<{ Params: { id: string } }>(
    '/api/group-invitations/:id/reject',
    {
      schema: {
        description: 'Reject a group invitation',
        tags: ['invitations'],
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
      app.logger.info({ userId: session.user.id, invitationId: id }, 'Rejecting group invitation');

      // Get invitation
      const invitation = await app.db
        .select()
        .from(schema.groupInvitations)
        .where(eq(schema.groupInvitations.id, id))
        .limit(1);

      if (invitation.length === 0) {
        app.logger.warn({ invitationId: id }, 'Invitation not found');
        return reply.status(404).send({ error: 'Invitation not found' });
      }

      const inv = invitation[0];

      // Check if this invitation is for the current user
      if (inv.invitedUserId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, invitationId: id, invitedUserId: inv.invitedUserId },
          'User not the invitee'
        );
        return reply.status(403).send({ error: 'This invitation is not for you' });
      }

      // Check if invitation is still pending
      if (inv.status !== 'pending') {
        app.logger.warn({ invitationId: id, status: inv.status }, 'Invitation already responded to');
        return reply.status(403).send({ error: 'This invitation has already been responded to' });
      }

      // Update invitation status
      await app.db
        .update(schema.groupInvitations)
        .set({
          status: 'rejected',
          respondedAt: new Date(),
        })
        .where(eq(schema.groupInvitations.id, id));

      // Mark related notification as read
      const notifications = await app.db
        .select()
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.userId, session.user.id),
            eq(schema.notifications.type, 'group_invitation')
          )
        );

      for (const notif of notifications) {
        const data = notif.data ? JSON.parse(notif.data) : {};
        if (data.invitationId === id) {
          await app.db
            .update(schema.notifications)
            .set({ read: true })
            .where(eq(schema.notifications.id, notif.id));
        }
      }

      app.logger.info({ userId: session.user.id, invitationId: id }, 'Group invitation rejected');
      return { success: true };
    }
  );

  // GET /api/group-invitations/pending - Get all pending invitations for the user
  app.fastify.get('/api/group-invitations/pending', {
    schema: {
      description: 'Get all pending group invitations for the authenticated user',
      tags: ['invitations'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              groupId: { type: 'string', format: 'uuid' },
              groupName: { type: 'string' },
              invitedByUserId: { type: 'string' },
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

    app.logger.info({ userId: session.user.id }, 'Fetching pending invitations');

    // Get all pending invitations for the user
    const invitations = await app.db
      .select({
        id: schema.groupInvitations.id,
        groupId: schema.groupInvitations.groupId,
        groupName: schema.groups.name,
        invitedByUserId: schema.groupInvitations.invitedByUserId,
        createdAt: schema.groupInvitations.createdAt,
      })
      .from(schema.groupInvitations)
      .innerJoin(schema.groups, eq(schema.groupInvitations.groupId, schema.groups.id))
      .where(
        and(
          eq(schema.groupInvitations.invitedUserId, session.user.id),
          eq(schema.groupInvitations.status, 'pending')
        )
      );

    const result = invitations.map((inv) => ({
      id: inv.id,
      groupId: inv.groupId,
      groupName: inv.groupName,
      invitedByUserId: inv.invitedByUserId,
      createdAt: inv.createdAt.toISOString(),
    }));

    app.logger.info({ userId: session.user.id, count: result.length }, 'Pending invitations retrieved');
    return result;
  });
}
