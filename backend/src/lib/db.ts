import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as appSchema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';

const isInternalUrl = process.env.DATABASE_URL?.includes('.railway.internal');
const client = postgres(process.env.DATABASE_URL!, {
  ssl: isInternalUrl ? false : { rejectUnauthorized: false },
});

export const db = drizzle(client, {
  schema: { ...appSchema, ...authSchema },
});
