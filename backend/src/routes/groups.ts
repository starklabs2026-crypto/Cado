import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

interface CreateGroupBody {
  name: string;
  description?: string;
  invitedUserIds: string[];
}

export function registerGroupRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/groups/create-private - Create a private group with invitations
  app.fastify.post<{ Body: CreateGroupBody }>(
    '/api/groups/create-private',
    {
      schema: {
        description: 'Create a private group and send invitations',
        tags: ['groups'],
        body: {
          type: 'object',
          required: ['name', 'invitedUserIds'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            invitedUserIds: { type: 'array', items: { type: 'string' } },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              groupId: { type: 'string' },
              invitationsSent: { type: 'number' },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateGroupBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { name, description, invitedUserIds } = request.body;
      app.logger.info({ userId: session.user.id, groupName: name }, 'Creating private group');

      // Create the group
      const newGroup = await app.db
        .insert(schema.groups)
        .values({
          name,
          description: description || null,
          createdByUserId: session.user.id,
          isPrivate: true,
        })
        .returning();

      const groupId = newGroup[0].id;

      // Add creator as admin member
      await app.db
        .insert(schema.groupMembers)
        .values({
          groupId,
          userId: session.user.id,
          role: 'admin',
        });

      // Create invitations and notifications for invited users
      let invitationsSent = 0;
      for (const invitedUserId of invitedUserIds) {
        try {
          // Create invitation
          const invitation = await app.db
            .insert(schema.groupInvitations)
            .values({
              groupId,
              invitedByUserId: session.user.id,
              invitedUserId,
              status: 'pending',
            })
            .returning();

          // Create notification
          await app.db
            .insert(schema.notifications)
            .values({
              userId: invitedUserId,
              type: 'group_invitation',
              title: `Invitation to join ${name}`,
              message: `${session.user.name || 'Someone'} invited you to join the group "${name}"`,
              data: JSON.stringify({ groupId, invitationId: invitation[0].id }),
            });

          invitationsSent++;
          app.logger.info(
            { groupId, invitedUserId, invitationId: invitation[0].id },
            'Group invitation created'
          );
        } catch (err) {
          app.logger.warn({ groupId, invitedUserId, err }, 'Failed to create invitation');
        }
      }

      app.logger.info({ groupId, invitationsSent }, 'Private group created with invitations');
      return reply.status(201).send({ groupId, invitationsSent });
    }
  );

  // GET /api/groups - Get all groups for the authenticated user
  app.fastify.get('/api/groups', {
    schema: {
      description: 'Get all groups the user is a member of',
      tags: ['groups'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              description: { type: ['string', 'null'] },
              memberCount: { type: 'number' },
              isPrivate: { type: 'boolean' },
              role: { type: 'string' },
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

    app.logger.info({ userId: session.user.id }, 'Fetching user groups');

    // Get all groups the user is a member of
    const userGroups = await app.db
      .select({
        groupId: schema.groups.id,
        groupName: schema.groups.name,
        description: schema.groups.description,
        isPrivate: schema.groups.isPrivate,
        createdAt: schema.groups.createdAt,
        role: schema.groupMembers.role,
      })
      .from(schema.groupMembers)
      .innerJoin(schema.groups, eq(schema.groupMembers.groupId, schema.groups.id))
      .where(eq(schema.groupMembers.userId, session.user.id));

    // Get member counts for each group
    const result = await Promise.all(
      userGroups.map(async (group) => {
        const members = await app.db
          .select()
          .from(schema.groupMembers)
          .where(eq(schema.groupMembers.groupId, group.groupId));

        return {
          id: group.groupId,
          name: group.groupName,
          description: group.description,
          memberCount: members.length,
          isPrivate: group.isPrivate,
          role: group.role,
          createdAt: group.createdAt.toISOString(),
        };
      })
    );

    app.logger.info({ userId: session.user.id, count: result.length }, 'User groups retrieved');
    return result;
  });

  // GET /api/groups/:id - Get detailed info about a specific group
  app.fastify.get<{ Params: { id: string } }>(
    '/api/groups/:id',
    {
      schema: {
        description: 'Get detailed information about a group',
        tags: ['groups'],
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
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              description: { type: ['string', 'null'] },
              isPrivate: { type: 'boolean' },
              members: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    userId: { type: 'string' },
                    role: { type: 'string' },
                    joinedAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
              createdAt: { type: 'string', format: 'date-time' },
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
      app.logger.info({ userId: session.user.id, groupId: id }, 'Fetching group details');

      // Get group details first
      const group = await app.db
        .select()
        .from(schema.groups)
        .where(eq(schema.groups.id, id))
        .limit(1);

      if (group.length === 0) {
        app.logger.warn({ groupId: id }, 'Group not found');
        return reply.status(404).send({ error: 'Group not found' });
      }

      // Check if user is a member of the group
      const membership = await app.db
        .select()
        .from(schema.groupMembers)
        .where(
          and(eq(schema.groupMembers.groupId, id), eq(schema.groupMembers.userId, session.user.id))
        )
        .limit(1);

      if (membership.length === 0) {
        app.logger.warn({ userId: session.user.id, groupId: id }, 'User not a group member');
        return reply.status(403).send({ error: 'Not a member of this group' });
      }

      // Get group members
      const members = await app.db
        .select()
        .from(schema.groupMembers)
        .where(eq(schema.groupMembers.groupId, id));

      const groupData = group[0];
      return {
        id: groupData.id,
        name: groupData.name,
        description: groupData.description,
        isPrivate: groupData.isPrivate,
        members: members.map((m) => ({
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
        })),
        createdAt: groupData.createdAt.toISOString(),
      };
    }
  );

  // POST /api/groups/:id/join - Join a public group
  app.fastify.post<{ Params: { id: string } }>(
    '/api/groups/:id/join',
    {
      schema: {
        description: 'Join a public group',
        tags: ['groups'],
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
              message: { type: 'string' },
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
      app.logger.info({ userId: session.user.id, groupId: id }, 'User attempting to join group');

      // Check if user is already a member
      const existingMembership = await app.db
        .select()
        .from(schema.groupMembers)
        .where(
          and(eq(schema.groupMembers.groupId, id), eq(schema.groupMembers.userId, session.user.id))
        )
        .limit(1);

      if (existingMembership.length > 0) {
        app.logger.warn({ userId: session.user.id, groupId: id }, 'User already a member');
        return reply.status(403).send({ error: 'You are already a member of this group' });
      }

      // Get group details
      const group = await app.db
        .select()
        .from(schema.groups)
        .where(eq(schema.groups.id, id))
        .limit(1);

      if (group.length === 0) {
        app.logger.warn({ groupId: id }, 'Group not found');
        return reply.status(404).send({ error: 'Group not found' });
      }

      // Check if group is private
      if (group[0].isPrivate) {
        app.logger.warn({ userId: session.user.id, groupId: id }, 'Cannot join private group without invitation');
        return reply.status(403).send({ error: 'This is a private group. You need an invitation to join.' });
      }

      // Add user as member
      await app.db
        .insert(schema.groupMembers)
        .values({
          groupId: id,
          userId: session.user.id,
          role: 'member',
        });

      app.logger.info({ userId: session.user.id, groupId: id }, 'User joined group successfully');
      return {
        success: true,
        message: `You have successfully joined the group "${group[0].name}"`,
      };
    }
  );
}
