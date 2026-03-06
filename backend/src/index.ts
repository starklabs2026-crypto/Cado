import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';
import { registerFoodEntryRoutes } from './routes/food-entries.js';
import { registerUserProfileRoutes } from './routes/user-profile.js';
import { registerUsageRoutes } from './routes/usage.js';
import { registerGroupRoutes } from './routes/groups.js';
import { registerInvitationRoutes } from './routes/invitations.js';
import { registerNotificationRoutes } from './routes/notifications.js';

const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Enable authentication with Better Auth
app.withAuth();

// Enable storage for file uploads
app.withStorage();

// Register routes
registerFoodEntryRoutes(app);
registerUserProfileRoutes(app);
registerUsageRoutes(app);
registerGroupRoutes(app);
registerInvitationRoutes(app);
registerNotificationRoutes(app);

await app.run();
app.logger.info('Application running');
