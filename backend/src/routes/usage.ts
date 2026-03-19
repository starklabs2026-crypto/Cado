import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

const FREE_TIER_DAILY_SCANS = 3;

// Get today's date as YYYY-MM-DD string
function getTodayDate(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function registerUsageRoutes(app: App) {
	const requireAuth = app.requireAuth();

	// GET /api/usage/today - Get today's usage
	app.fastify.get(
		'/api/usage/today',
		{
			schema: {
				description: 'Get today usage information',
				tags: ['usage'],
				response: {
					200: {
						type: 'object',
						properties: {
							date: { type: 'string' },
							scans_count: { type: 'integer' },
							scans_remaining: { type: 'integer' },
							is_pro: { type: 'boolean' },
							can_scan: { type: 'boolean' },
						},
					},
					401: {
						type: 'object',
						properties: { error: { type: 'string' } },
					},
				},
			},
		},
		async (request: FastifyRequest, reply: FastifyReply) => {
			const session = await requireAuth(request, reply);
			if (!session) return;

			app.logger.info({ userId: session.user.id }, 'Getting today usage');

			const todayDate = getTodayDate();

			// Get user profile
			const profiles = await app.db
				.select()
				.from(schema.userProfiles)
				.where(eq(schema.userProfiles.userId, session.user.id))
				.limit(1);

			const isPro = profiles.length > 0 ? profiles[0].isPro : false;

			// Get today's usage
			const usage = await app.db
				.select()
				.from(schema.dailyUsage)
				.where(
					and(
						eq(schema.dailyUsage.userId, session.user.id),
						eq(schema.dailyUsage.date, todayDate),
					),
				)
				.limit(1);

			const scansCount = usage.length > 0 ? usage[0].scansCount : 0;
			const scansRemaining = -1; // Unlimited
			const canScan = true;

			app.logger.info(
				{ userId: session.user.id, scansCount, canScan },
				'Today usage retrieved',
			);

			return {
				date: todayDate,
				scans_count: scansCount,
				scans_remaining: scansRemaining,
				is_pro: isPro,
				can_scan: canScan,
			};
		},
	);

	// POST /api/usage/increment - Increment scan count
	app.fastify.post(
		'/api/usage/increment',
		{
			schema: {
				description: 'Increment daily scan count',
				tags: ['usage'],
				response: {
					200: {
						type: 'object',
						properties: {
							scans_count: { type: 'integer' },
							scans_remaining: { type: 'integer' },
							can_scan: { type: 'boolean' },
						},
					},
					401: {
						type: 'object',
						properties: { error: { type: 'string' } },
					},
					429: {
						type: 'object',
						properties: { error: { type: 'string' } },
					},
				},
			},
		},
		async (request: FastifyRequest, reply: FastifyReply) => {
			const session = await requireAuth(request, reply);
			if (!session) return;

			app.logger.info(
				{ userId: session.user.id },
				'Incrementing scan count',
			);

			const todayDate = getTodayDate();

			// Get user profile
			const profiles = await app.db
				.select()
				.from(schema.userProfiles)
				.where(eq(schema.userProfiles.userId, session.user.id))
				.limit(1);

			const isPro = profiles.length > 0 ? profiles[0].isPro : false;

			// Get today's usage
			let usage = await app.db
				.select()
				.from(schema.dailyUsage)
				.where(
					and(
						eq(schema.dailyUsage.userId, session.user.id),
						eq(schema.dailyUsage.date, todayDate),
					),
				)
				.limit(1);

			let scansCount = 0;

			if (usage.length === 0) {
				// Create new usage record
				const created = await app.db
					.insert(schema.dailyUsage)
					.values({
						userId: session.user.id,
						date: todayDate,
						scansCount: 1,
					})
					.returning();
				scansCount = created[0].scansCount;
			} else {
				// Limit check removed
				// Increment count
				const updated = await app.db
					.update(schema.dailyUsage)
					.set({ scansCount: usage[0].scansCount + 1 })
					.where(
						and(
							eq(schema.dailyUsage.userId, session.user.id),
							eq(schema.dailyUsage.date, todayDate),
						),
					)
					.returning();
				scansCount = updated[0].scansCount;
			}

			const scansRemaining = -1; // Unlimited
			const canScan = true;

			app.logger.info(
				{ userId: session.user.id, scansCount, canScan },
				'Scan count incremented',
			);

			return {
				scans_count: scansCount,
				scans_remaining: scansRemaining,
				can_scan: canScan,
			};
		},
	);

	// GET /api/usage/check-limit - Check if user can scan
	app.fastify.get(
		'/api/usage/check-limit',
		{
			schema: {
				description: 'Check if user can scan',
				tags: ['usage'],
				response: {
					200: {
						type: 'object',
						properties: {
							can_scan: { type: 'boolean' },
							reason: { type: ['string', 'null'] },
						},
					},
					401: {
						type: 'object',
						properties: { error: { type: 'string' } },
					},
				},
			},
		},
		async (request: FastifyRequest, reply: FastifyReply) => {
			const session = await requireAuth(request, reply);
			if (!session) return;

			app.logger.info({ userId: session.user.id }, 'Checking scan limit');

			const todayDate = getTodayDate();

			// Get user profile
			const profiles = await app.db
				.select()
				.from(schema.userProfiles)
				.where(eq(schema.userProfiles.userId, session.user.id))
				.limit(1);

			const isPro = profiles.length > 0 ? profiles[0].isPro : false;

			if (isPro) {
				return { can_scan: true, reason: null };
			}

			// Limit check removed for free users
			const canScan = true;
			const reason = null;

			app.logger.info(
				{ userId: session.user.id, canScan },
				'Scan limit checked',
			);

			return { can_scan: canScan, reason };
		},
	);
}
