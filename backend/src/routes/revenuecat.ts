import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

type RCEventType =
	| 'INITIAL_PURCHASE'
	| 'RENEWAL'
	| 'CANCELLATION'
	| 'EXPIRATION'
	| 'UNCANCELLATION'
	| 'BILLING_ISSUE'
	| 'PRODUCT_CHANGE'
	| 'SUBSCRIBER_ALIAS'
	| 'TRANSFER';

interface RCEvent {
	type: RCEventType;
	app_user_id: string;
	original_app_user_id: string;
	expiration_at_ms: number | null;
	product_id: string;
	environment: 'PRODUCTION' | 'SANDBOX';
}

interface RCWebhookBody {
	event: RCEvent;
	api_version: string;
}

export function registerRevenueCatRoutes(app: App) {
	app.fastify.post<{ Body: RCWebhookBody }>(
		'/api/webhooks/revenuecat',
		{
			schema: {
				description: 'RevenueCat subscription webhook handler',
				tags: ['webhooks'],
				body: {
					type: 'object',
					properties: {
						event: { type: 'object' },
						api_version: { type: 'string' },
					},
				},
			},
		},
		async (
			request: FastifyRequest<{ Body: RCWebhookBody }>,
			reply: FastifyReply,
		) => {
			// Validate the shared webhook secret set in RevenueCat dashboard
			const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
			if (secret) {
				const authHeader = request.headers.authorization;
				if (authHeader !== secret) {
					app.logger.warn(
						{ authHeader },
						'RevenueCat webhook: invalid authorization header',
					);
					return reply.status(401).send({ error: 'Unauthorized' });
				}
			}

			const { event } = request.body;
			if (!event?.type) {
				return reply.status(400).send({ error: 'Invalid webhook payload' });
			}

			// When you call Purchases.logIn(user.id) in the app, RC uses that as app_user_id
			const userId = event.app_user_id;

			app.logger.info(
				{ type: event.type, userId, env: event.environment },
				'RevenueCat webhook received',
			);

			// Skip sandbox events if running in production to avoid test data pollution
			if (
				process.env.NODE_ENV === 'production' &&
				event.environment === 'SANDBOX'
			) {
				return reply.status(200).send({ received: true, skipped: 'sandbox' });
			}

			try {
				switch (event.type) {
					case 'INITIAL_PURCHASE':
					case 'RENEWAL':
					case 'UNCANCELLATION': {
						const proExpiresAt = event.expiration_at_ms
							? new Date(event.expiration_at_ms)
							: null;

						const existing = await app.db
							.select()
							.from(schema.userProfiles)
							.where(eq(schema.userProfiles.userId, userId))
							.limit(1);

						if (existing.length > 0) {
							await app.db
								.update(schema.userProfiles)
								.set({
									isPro: true,
									...(proExpiresAt && { proExpiresAt }),
									updatedAt: new Date(),
								})
								.where(eq(schema.userProfiles.userId, userId));
						} else {
							// Create profile if user somehow doesn't have one yet
							await app.db.insert(schema.userProfiles).values({
								userId,
								isPro: true,
								proExpiresAt: proExpiresAt ?? undefined,
								onboardingCompleted: false,
							});
						}

						app.logger.info(
							{ userId, proExpiresAt, type: event.type },
							'User upgraded to Pro',
						);
						break;
					}

					case 'EXPIRATION': {
						// Subscription has fully expired — revoke Pro access
						await app.db
							.update(schema.userProfiles)
							.set({ isPro: false, updatedAt: new Date() })
							.where(eq(schema.userProfiles.userId, userId));
						app.logger.info({ userId }, 'Pro access revoked on expiration');
						break;
					}

					case 'CANCELLATION': {
						// User cancelled but Pro continues until proExpiresAt — do nothing here.
						// EXPIRATION event will revoke access at the right time.
						app.logger.info(
							{ userId },
							'Subscription cancelled — Pro continues until expiry',
						);
						break;
					}

					case 'BILLING_ISSUE': {
						app.logger.warn({ userId }, 'Billing issue on RevenueCat subscription');
						break;
					}

					default: {
						app.logger.info(
							{ type: event.type },
							'Unhandled RevenueCat event type — skipping',
						);
					}
				}

				return reply.status(200).send({ received: true });
			} catch (error) {
				app.logger.error(
					{ err: error, userId, type: event.type },
					'RevenueCat webhook processing failed',
				);
				return reply.status(500).send({ error: 'Processing failed' });
			}
		},
	);
}
