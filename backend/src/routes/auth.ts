import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import * as authSchema from '../db/schema/auth-schema.js';
import * as appSchema from '../db/schema/schema.js';

const GUEST_SESSION_LIMIT_DAYS = 7;

interface GuestRegistrationResponse {
  userId: string;
  sessionToken: string;
  email: string;
  name: string;
  isGuest: boolean;
}

export function registerAuthRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/auth/guest-status - Check if a guest session is within the 7-day window
  app.fastify.get(
    '/api/auth/guest-status',
    {
      schema: {
        description: 'Check if the authenticated guest session is still valid',
        tags: ['auth'],
        response: {
          200: {
            type: 'object',
            properties: {
              is_guest: { type: 'boolean' },
              expired: { type: 'boolean' },
              days_remaining: { type: 'integer' },
            },
          },
          401: {
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const users = await app.db
        .select()
        .from(authSchema.user)
        .where(eq(authSchema.user.id, session.user.id))
        .limit(1);

      if (users.length === 0) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const dbUser = users[0];

      if (!dbUser.isGuest) {
        // Regular users never expire
        return { is_guest: false, expired: false, days_remaining: -1 };
      }

      const createdAt = new Date(dbUser.createdAt);
      const now = new Date();
      const diffMs = now.getTime() - createdAt.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const expired = diffDays >= GUEST_SESSION_LIMIT_DAYS;
      const days_remaining = Math.max(0, GUEST_SESSION_LIMIT_DAYS - diffDays);

      app.logger.info(
        { userId: dbUser.id, diffDays, expired, days_remaining },
        'Guest session status checked',
      );

      return { is_guest: true, expired, days_remaining };
    },
  );

  // POST /api/auth/guest - Register as a guest user
  app.fastify.post<{ Body: {} }>(
    '/api/auth/guest',
    {
      schema: {
        description: 'Register as a guest user with limited features',
        tags: ['auth'],
        response: {
          201: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              sessionToken: { type: 'string' },
              email: { type: 'string' },
              name: { type: 'string' },
              isGuest: { type: 'boolean' },
            },
          },
          500: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      app.logger.info('Creating guest user');

      try {
        // Generate unique guest ID
        const guestId = `guest_${randomBytes(8).toString('hex')}`;
        const guestEmail = `${guestId}@calo.app`;

        // Create guest user
        const newUser = await app.db
          .insert(authSchema.user)
          .values({
            id: guestId,
            name: `Guest_${randomBytes(4).toString('hex').substring(0, 8)}`,
            email: guestEmail,
            emailVerified: true,
            isGuest: true,
          })
          .returning();

        const user = newUser[0];
        app.logger.info({ userId: user.id, email: user.email }, 'Guest user created');

        // Create user profile with onboarding not completed
        await app.db
          .insert(appSchema.userProfiles)
          .values({
            userId: user.id,
            onboardingCompleted: false,
            isPro: false,
          });

        app.logger.info({ userId: user.id }, 'Guest user profile created');

        // Create session for the guest user
        const sessionToken = randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 day session

        const session = await app.db
          .insert(authSchema.session)
          .values({
            id: randomBytes(16).toString('hex'),
            token: sessionToken,
            expiresAt,
            userId: user.id,
            userAgent: request.headers['user-agent'],
            ipAddress: request.ip,
          })
          .returning();

        app.logger.info(
          { userId: user.id, sessionId: session[0].id },
          'Guest user session created'
        );

        const response: GuestRegistrationResponse = {
          userId: user.id,
          sessionToken,
          email: user.email,
          name: user.name,
          isGuest: true,
        };

        return reply.status(201).send(response);
      } catch (err) {
        app.logger.error({ err }, 'Failed to create guest user');
        return reply.status(500).send({ error: 'Failed to create guest user' });
      }
    }
  );

  // POST /api/guest - Create a guest user (alternate endpoint)
  app.fastify.post<{ Body: {} }>(
    '/api/guest',
    {
      schema: {
        description: 'Create a temporary guest user account',
        tags: ['auth'],
        response: {
          201: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  isGuest: { type: 'boolean' },
                  onboarding_completed: { type: 'boolean' },
                  is_pro: { type: 'boolean' },
                },
              },
              token: { type: 'string' },
            },
          },
          500: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      app.logger.info('Creating guest user via /api/guest');

      try {
        // Generate unique guest ID
        const guestId = `guest_${randomBytes(8).toString('hex')}`;
        const guestEmail = `${guestId}@calo.app`;

        // Create guest user
        const newUser = await app.db
          .insert(authSchema.user)
          .values({
            id: guestId,
            name: `Guest_${randomBytes(4).toString('hex').substring(0, 8)}`,
            email: guestEmail,
            emailVerified: true,
            isGuest: true,
          })
          .returning();

        const user = newUser[0];
        app.logger.info({ userId: user.id, email: user.email }, 'Guest user created');

        // Create user profile with onboarding not completed
        await app.db
          .insert(appSchema.userProfiles)
          .values({
            userId: user.id,
            onboardingCompleted: false,
            isPro: false,
          });

        app.logger.info({ userId: user.id }, 'Guest user profile created');

        // Create session for the guest user
        const sessionToken = randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 day session

        const session = await app.db
          .insert(authSchema.session)
          .values({
            id: randomBytes(16).toString('hex'),
            token: sessionToken,
            expiresAt,
            userId: user.id,
            userAgent: request.headers['user-agent'],
            ipAddress: request.ip,
          })
          .returning();

        app.logger.info(
          { userId: user.id, sessionId: session[0].id },
          'Guest user session created'
        );

        return reply.status(201).send({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            isGuest: user.isGuest,
            onboarding_completed: false,
            is_pro: false,
          },
          token: sessionToken,
        });
      } catch (err) {
        app.logger.error({ err }, 'Failed to create guest user');
        return reply.status(500).send({ error: 'Failed to create guest user' });
      }
    }
  );
}
