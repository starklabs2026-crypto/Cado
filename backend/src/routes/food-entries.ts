import type { App } from '../index.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lt, ilike, or } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import { gateway } from '@specific-dev/framework';
import { generateObject } from 'ai';
import { z } from 'zod';

interface CreateFoodEntryBody {
  foodName: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  mealType?: string;
}

interface UpdateFoodEntryBody {
  foodName?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  mealType?: string;
}

interface FromImageBody {
  foodName: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  imageUrl: string;
  mealType?: string;
  databaseFoodId?: string;
}

interface AnalyzeImageResponse {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  imageUrl: string;
  confidence: string;
  databaseSuggestions?: Array<{
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
}

interface FoodSearchResult {
  id: string;
  name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: number;
}

const nutritionSchema = z.object({
  foodName: z.string().describe('Name of the identified food'),
  calories: z.number().describe('Estimated calorie count for the portion shown'),
  protein: z.number().describe('Estimated protein in grams for the portion shown'),
  carbs: z.number().describe('Estimated carbs in grams for the portion shown'),
  fat: z.number().describe('Estimated fat in grams for the portion shown'),
  confidence: z.enum(['high', 'medium', 'low']).describe('Confidence level: high=certain identification, medium=type clear, low=unclear/difficult to estimate'),
});

// Helper function for fuzzy search with case-insensitive matching
function calculateRelevance(query: string, foodName: string, aliases: string[] = []): number {
  const lowerQuery = query.toLowerCase().trim();
  const lowerName = foodName.toLowerCase().trim();

  // Exact match = 3
  if (lowerName === lowerQuery) return 3;

  // Exact match in aliases = 2.9
  if (aliases?.some(a => a && a.toLowerCase().trim() === lowerQuery)) return 2.9;

  // Starts with = 2
  if (lowerName.startsWith(lowerQuery)) return 2;

  // Alias starts with = 1.9
  if (aliases?.some(a => a && a.toLowerCase().trim().startsWith(lowerQuery))) return 1.9;

  // Contains = 1
  if (lowerName.includes(lowerQuery)) return 1;

  // Alias contains = 0.9
  if (aliases?.some(a => a && a.toLowerCase().includes(lowerQuery))) return 0.9;

  // Word boundary match (e.g., "ice" in "vanilla ice cream") = 0.8
  const words = lowerName.split(/\s+/);
  if (words.some(word => word.startsWith(lowerQuery))) return 0.8;

  return 0;
}

export function registerFoodEntryRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/food/search - Search food database
  app.fastify.post<{ Body: { query: string; category?: string } }>(
    '/api/food/search',
    {
      schema: {
        description: 'Search the food database with fuzzy matching',
        tags: ['food-database'],
        body: {
          type: 'object',
          required: ['query'],
          properties: {
            query: { type: 'string' },
            category: { type: 'string', enum: ['indian', 'fast_food', 'beverage', 'ice_cream', 'dessert', 'other'] },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                category: { type: 'string' },
                calories: { type: 'number' },
                protein: { type: 'number' },
                carbs: { type: 'number' },
                fat: { type: 'number' },
                servingSize: { type: 'number' },
              },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { query: string; category?: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { query, category } = request.body;
      app.logger.info({ userId: session.user.id, query, category }, 'Searching food database');

      // Normalize query for case-insensitive searching
      const lowerQuery = query.toLowerCase();

      // Build database query - fetch all foods in category if specified, otherwise all
      const dbQuery = category
        ? app.db
            .select()
            .from(schema.foodDatabase)
            .where(eq(schema.foodDatabase.category, category))
        : app.db
            .select()
            .from(schema.foodDatabase);

      const allFoods = await dbQuery;

      // Filter and score results by searching in both name AND aliases
      const scored = allFoods
        .map((item) => {
          const nameRelevance = calculateRelevance(query, item.name, item.aliases || []);

          // Also check if query matches any alias
          let aliasMatch = false;
          if (item.aliases && item.aliases.length > 0) {
            aliasMatch = item.aliases.some(alias =>
              alias.toLowerCase().includes(lowerQuery)
            );
          }

          // Give bonus to exact alias matches
          let finalRelevance = nameRelevance;
          if (aliasMatch && nameRelevance === 0) {
            // If no name match but alias matches, give it a base relevance
            const bestAliasRelevance = Math.max(
              ...item.aliases.map(a => calculateRelevance(query, a))
            );
            finalRelevance = bestAliasRelevance * 0.95; // Slightly lower than name match
          }

          return {
            item,
            relevance: finalRelevance,
          };
        })
        .filter((r) => r.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance);

      const response: FoodSearchResult[] = scored.map((r) => ({
        id: r.item.id,
        name: r.item.name,
        category: r.item.category,
        calories: Math.round(r.item.caloriesPer100g * (r.item.servingSizeG / 100)),
        protein: Math.round((r.item.proteinPer100g * (r.item.servingSizeG / 100)) * 10) / 10,
        carbs: Math.round((r.item.carbsPer100g * (r.item.servingSizeG / 100)) * 10) / 10,
        fat: Math.round((r.item.fatPer100g * (r.item.servingSizeG / 100)) * 10) / 10,
        servingSize: r.item.servingSizeG,
      }));

      app.logger.info({ userId: session.user.id, resultCount: response.length, query }, 'Food search completed');
      return response;
    }
  );

  // GET /api/food/database/:id - Get food item by ID
  app.fastify.get<{ Params: { id: string } }>(
    '/api/food/database/:id',
    {
      schema: {
        description: 'Get full nutritional info for a food item from database',
        tags: ['food-database'],
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
              category: { type: 'string' },
              caloriesPer100g: { type: 'number' },
              proteinPer100g: { type: 'number' },
              carbsPer100g: { type: 'number' },
              fatPer100g: { type: 'number' },
              servingSize: { type: 'number' },
              description: { type: ['string', 'null'] },
              aliases: { type: ['array', 'null'], items: { type: 'string' } },
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
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      app.logger.info({ userId: session.user.id, foodId: id }, 'Fetching food database item');

      const food = await app.db
        .select()
        .from(schema.foodDatabase)
        .where(eq(schema.foodDatabase.id, id))
        .limit(1);

      if (food.length === 0) {
        app.logger.warn({ foodId: id }, 'Food item not found');
        return reply.status(404).send({ error: 'Food item not found' });
      }

      const item = food[0];
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        caloriesPer100g: item.caloriesPer100g,
        proteinPer100g: item.proteinPer100g,
        carbsPer100g: item.carbsPer100g,
        fatPer100g: item.fatPer100g,
        servingSize: item.servingSizeG,
        description: item.description,
        aliases: item.aliases,
      };
    }
  );

  // POST /api/food/analyze-image - Analyze food image with AI
  app.fastify.post(
    '/api/food/analyze-image',
    {
      schema: {
        description: 'Analyze a food image and extract nutritional information using GPT-4 Vision AI',
        tags: ['food-ai'],
        response: {
          200: {
            type: 'object',
            properties: {
              foodName: { type: 'string' },
              calories: { type: 'number' },
              protein: { type: 'number' },
              carbs: { type: 'number' },
              fat: { type: 'number' },
              imageUrl: { type: 'string' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              databaseSuggestions: {
                type: ['array', 'null'],
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    calories: { type: 'number' },
                    protein: { type: 'number' },
                    carbs: { type: 'number' },
                    fat: { type: 'number' },
                  },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          413: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id }, 'Analyzing food image');

      // Get file from request
      const data = await request.file({ limits: { fileSize: 10 * 1024 * 1024 } });
      if (!data) {
        app.logger.warn({ userId: session.user.id }, 'No file provided for image analysis');
        return reply.status(400).send({ error: 'No image file provided' });
      }

      let buffer: Buffer;
      try {
        buffer = await data.toBuffer();
      } catch (err) {
        app.logger.warn({ userId: session.user.id, err }, 'File too large');
        return reply.status(413).send({ error: 'File size limit exceeded (10MB max)' });
      }

      // Validate that the file is not empty
      if (buffer.length === 0) {
        app.logger.warn({ userId: session.user.id }, 'Empty image file provided');
        return reply.status(400).send({ error: 'Image file cannot be empty' });
      }

      // Upload image to storage
      const storageKey = `food-images/${Date.now()}-${data.filename}`;
      let uploadedKey: string;
      try {
        uploadedKey = await app.storage.upload(storageKey, buffer);
        app.logger.info({ userId: session.user.id, key: uploadedKey }, 'Image uploaded to storage');
      } catch (err) {
        app.logger.error({ userId: session.user.id, err }, 'Failed to upload image');
        return reply.status(500).send({ error: 'Failed to upload image' });
      }

      // Get signed URL for the image
      let imageUrl: string;
      try {
        const signedUrlResult = await app.storage.getSignedUrl(uploadedKey);
        imageUrl = signedUrlResult.url;
        app.logger.info({ userId: session.user.id, imageUrl }, 'Generated signed URL for image');
      } catch (err) {
        app.logger.error({ userId: session.user.id, err }, 'Failed to generate signed URL');
        return reply.status(500).send({ error: 'Failed to generate image URL' });
      }

      // Convert image to base64 for AI analysis
      const base64 = buffer.toString('base64');

      // Use GPT-4 Vision to analyze the food image
      let nutritionData: z.infer<typeof nutritionSchema>;
      try {
        app.logger.info({ userId: session.user.id }, 'Calling GPT-4 Vision to analyze food image');
        const result = await generateObject({
          model: gateway('openai/gpt-4o'),
          schema: nutritionSchema,
          schemaName: 'FoodNutrition',
          schemaDescription: 'Extract nutritional information from a food image',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  image: base64,
                },
                {
                  type: 'text',
                  text: `You are an expert food nutritionist and dietary analyst. Analyze this food image and provide accurate nutritional information.

IMPORTANT CATEGORIES TO HANDLE:
- INDIAN FOODS: biryani, butter chicken, samosa, bhujia, sev, dosa, idli, gulab jamun, paneer tikka, naan, roti, dal, curry varieties, pakora, jalebi, rasgulla, etc.
- FAST FOOD: burgers, pizza, fries, nuggets, sandwiches, wraps, tacos
- BEVERAGES: sodas, juices, smoothies, coffee drinks, tea, energy drinks, milkshakes
- ICE CREAM: vanilla, chocolate, strawberry, mango, butterscotch, and other flavors
- DESSERTS: cakes, cookies, brownies, pastries, donuts

INSTRUCTIONS:
1. Identify the SPECIFIC food name (e.g., "Butter Chicken" not just "curry", "Samosa" not "Indian snack")
2. Estimate portion size shown in the image
3. Provide nutritional values for the PORTION shown
4. Set confidence based on:
   - HIGH: Clear identification with visible portion, typical preparation method
   - MEDIUM: Type is clear but portion or exact preparation unclear
   - LOW: Cannot clearly identify or estimate portions accurately

Return values for the portion shown in the image, not per 100g.`,
                },
              ],
            },
          ],
        });
        nutritionData = result.object;
        app.logger.info(
          { userId: session.user.id, foodName: nutritionData.foodName, calories: nutritionData.calories, confidence: nutritionData.confidence },
          'Food image analyzed with GPT-4 Vision'
        );
      } catch (err) {
        app.logger.warn({ userId: session.user.id, err }, 'AI analysis failed, using default values');
        nutritionData = {
          foodName: 'Unknown Food',
          calories: 150,
          protein: 10,
          carbs: 15,
          fat: 5,
          confidence: 'low',
        };
      }

      // If confidence is low, search database for best matches
      let databaseSuggestions: AnalyzeImageResponse['databaseSuggestions'] = undefined;
      if (nutritionData.confidence === 'low' && nutritionData.foodName !== 'Unknown Food') {
        try {
          app.logger.info({ foodName: nutritionData.foodName }, 'Searching database for low-confidence result');
          const matches = await app.db
            .select()
            .from(schema.foodDatabase)
            .where(ilike(schema.foodDatabase.name, `%${nutritionData.foodName}%`));

          const scored = matches
            .map((item) => ({
              item,
              relevance: calculateRelevance(nutritionData.foodName, item.name, item.aliases || []),
            }))
            .filter((r) => r.relevance > 0)
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, 3);

          if (scored.length > 0) {
            databaseSuggestions = scored.map((r) => ({
              id: r.item.id,
              name: r.item.name,
              calories: Math.round(r.item.caloriesPer100g * (r.item.servingSizeG / 100)),
              protein: Math.round((r.item.proteinPer100g * (r.item.servingSizeG / 100)) * 10) / 10,
              carbs: Math.round((r.item.carbsPer100g * (r.item.servingSizeG / 100)) * 10) / 10,
              fat: Math.round((r.item.fatPer100g * (r.item.servingSizeG / 100)) * 10) / 10,
            }));
            app.logger.info({ suggestions: databaseSuggestions.length }, 'Database suggestions found');
          }
        } catch (dbErr) {
          app.logger.warn({ err: dbErr }, 'Failed to fetch database suggestions');
        }
      }

      const response: AnalyzeImageResponse = {
        ...nutritionData,
        imageUrl,
      };

      if (databaseSuggestions) {
        response.databaseSuggestions = databaseSuggestions;
      }

      return response;
    }
  );

  // POST /api/food-entries/from-image - Create food entry from image analysis
  app.fastify.post<{ Body: FromImageBody }>(
    '/api/food-entries/from-image',
    {
      schema: {
        description: 'Create a food entry from AI image analysis results',
        tags: ['food-ai'],
        body: {
          type: 'object',
          required: ['foodName', 'calories', 'imageUrl'],
          properties: {
            foodName: { type: 'string' },
            calories: { type: 'number' },
            protein: { type: 'number' },
            carbs: { type: 'number' },
            fat: { type: 'number' },
            imageUrl: { type: 'string' },
            mealType: { type: 'string' },
            databaseFoodId: { type: 'string', format: 'uuid', description: 'Optional: ID of food from database to use instead of AI values' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              userId: { type: 'string' },
              foodName: { type: 'string' },
              calories: { type: 'number' },
              protein: { type: ['number', 'null'] },
              carbs: { type: ['number', 'null'] },
              fat: { type: ['number', 'null'] },
              mealType: { type: ['string', 'null'] },
              imageUrl: { type: ['string', 'null'] },
              recognizedByAi: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
          400: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: FromImageBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { foodName, calories, protein, carbs, fat, imageUrl, mealType, databaseFoodId } = request.body;
      app.logger.info(
        { userId: session.user.id, foodName, calories, imageUrl, databaseFoodId },
        'Creating food entry from image analysis'
      );

      // If databaseFoodId is provided, use data from database
      let finalCalories = calories;
      let finalProtein = protein;
      let finalCarbs = carbs;
      let finalFat = fat;
      let finalFoodName = foodName;

      if (databaseFoodId) {
        const dbFood = await app.db
          .select()
          .from(schema.foodDatabase)
          .where(eq(schema.foodDatabase.id, databaseFoodId))
          .limit(1);

        if (dbFood.length > 0) {
          const food = dbFood[0];
          finalFoodName = food.name;
          finalCalories = Math.round(food.caloriesPer100g * (food.servingSizeG / 100));
          finalProtein = Math.round((food.proteinPer100g * (food.servingSizeG / 100)) * 10) / 10;
          finalCarbs = Math.round((food.carbsPer100g * (food.servingSizeG / 100)) * 10) / 10;
          finalFat = Math.round((food.fatPer100g * (food.servingSizeG / 100)) * 10) / 10;
          app.logger.info({ databaseFoodId, finalFoodName }, 'Using database food data');
        }
      }

      const newEntry = await app.db
        .insert(schema.foodEntries)
        .values({
          userId: session.user.id,
          foodName: finalFoodName,
          calories: finalCalories,
          protein: finalProtein !== undefined ? finalProtein : null,
          carbs: finalCarbs !== undefined ? finalCarbs : null,
          fat: finalFat !== undefined ? finalFat : null,
          mealType: mealType !== undefined ? mealType : null,
          imageUrl,
          recognizedByAi: true,
          createdAt: new Date(),
        })
        .returning();

      app.logger.info(
        { entryId: newEntry[0].id, userId: session.user.id, recognizedByAi: true },
        'Food entry created from image analysis successfully'
      );
      return reply.status(201).send(newEntry[0]);
    }
  );

  // GET /api/food-entries - All entries for user, ordered by createdAt DESC
  app.fastify.get('/api/food-entries', {
    schema: {
      description: 'Get all food entries for the authenticated user',
      tags: ['food-entries'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              foodName: { type: 'string' },
              calories: { type: 'number' },
              protein: { type: ['number', 'null'] },
              carbs: { type: ['number', 'null'] },
              fat: { type: ['number', 'null'] },
              mealType: { type: ['string', 'null'] },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching all food entries');
    const entries = await app.db
      .select()
      .from(schema.foodEntries)
      .where(eq(schema.foodEntries.userId, session.user.id))
      .orderBy((entries) => entries.createdAt);

    const sortedEntries = entries.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    app.logger.info({ userId: session.user.id, count: sortedEntries.length }, 'Food entries retrieved');
    return sortedEntries;
  });

  // GET /api/food-entries/today - Today's entries for user
  app.fastify.get('/api/food-entries/today', {
    schema: {
      description: 'Get food entries for today for the authenticated user',
      tags: ['food-entries'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              foodName: { type: 'string' },
              calories: { type: 'number' },
              protein: { type: ['number', 'null'] },
              carbs: { type: ['number', 'null'] },
              fat: { type: ['number', 'null'] },
              mealType: { type: ['string', 'null'] },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching today food entries');

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const entries = await app.db
      .select()
      .from(schema.foodEntries)
      .where(
        and(
          eq(schema.foodEntries.userId, session.user.id),
          gte(schema.foodEntries.createdAt, startOfDay),
          lt(schema.foodEntries.createdAt, endOfDay)
        )
      )
      .orderBy((entries) => entries.createdAt);

    const sortedEntries = entries.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    app.logger.info({ userId: session.user.id, count: sortedEntries.length }, 'Today food entries retrieved');
    return sortedEntries;
  });

  // GET /api/food-entries/stats/today - Today's stats for user
  app.fastify.get('/api/food-entries/stats/today', {
    schema: {
      description: 'Get food statistics for today for the authenticated user',
      tags: ['food-entries'],
      response: {
        200: {
          type: 'object',
          properties: {
            totalCalories: { type: 'number' },
            totalProtein: { type: 'number' },
            totalCarbs: { type: 'number' },
            totalFat: { type: 'number' },
            entryCount: { type: 'number' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching today food statistics');

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const entries = await app.db
      .select()
      .from(schema.foodEntries)
      .where(
        and(
          eq(schema.foodEntries.userId, session.user.id),
          gte(schema.foodEntries.createdAt, startOfDay),
          lt(schema.foodEntries.createdAt, endOfDay)
        )
      );

    const stats = entries.reduce(
      (acc, entry) => ({
        totalCalories: acc.totalCalories + entry.calories,
        totalProtein: acc.totalProtein + (entry.protein || 0),
        totalCarbs: acc.totalCarbs + (entry.carbs || 0),
        totalFat: acc.totalFat + (entry.fat || 0),
        entryCount: acc.entryCount + 1,
      }),
      { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, entryCount: 0 }
    );

    app.logger.info({ userId: session.user.id, stats }, 'Today food statistics retrieved');
    return stats;
  });

  // GET /api/food-entries/history - History grouped by date
  app.fastify.get<{ Querystring: { days?: string } }>(
    '/api/food-entries/history',
    {
      schema: {
        description: 'Get food entries history grouped by date (last N days)',
        tags: ['food-entries'],
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'string', description: 'Number of days (default 7, max 365)' },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string' },
                entries: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      foodName: { type: 'string' },
                      calories: { type: 'number' },
                      protein: { type: ['number', 'null'] },
                      carbs: { type: ['number', 'null'] },
                      fat: { type: ['number', 'null'] },
                      mealType: { type: ['string', 'null'] },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
                stats: {
                  type: 'object',
                  properties: {
                    totalCalories: { type: 'number' },
                    totalProtein: { type: 'number' },
                    totalCarbs: { type: 'number' },
                    totalFat: { type: 'number' },
                  },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { days?: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const daysParam = parseInt(request.query.days || '7', 10);
      const days = Math.min(Math.max(daysParam, 1), 365);

      app.logger.info({ userId: session.user.id, days }, 'Fetching food entries history');

      // Get user profile to check if pro
      const profiles = await app.db
        .select()
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.userId, session.user.id))
        .limit(1);

      const isPro = profiles.length > 0 ? profiles[0].isPro : false;
      const maxDays = isPro ? 365 : 7;
      const actualDays = Math.min(days, maxDays);

      // Get entries from the last N days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - actualDays);
      startDate.setHours(0, 0, 0, 0);

      const entries = await app.db
        .select()
        .from(schema.foodEntries)
        .where(
          and(
            eq(schema.foodEntries.userId, session.user.id),
            gte(schema.foodEntries.createdAt, startDate)
          )
        );

      // Group by date
      const grouped = new Map<string, any[]>();
      entries.forEach((entry) => {
        const dateStr = new Date(entry.createdAt).toISOString().split('T')[0];
        if (!grouped.has(dateStr)) {
          grouped.set(dateStr, []);
        }
        grouped.get(dateStr)!.push(entry);
      });

      // Build result with stats
      const result = Array.from(grouped.entries())
        .map(([date, dayEntries]) => {
          const stats = dayEntries.reduce(
            (acc, entry) => ({
              totalCalories: acc.totalCalories + entry.calories,
              totalProtein: acc.totalProtein + (entry.protein || 0),
              totalCarbs: acc.totalCarbs + (entry.carbs || 0),
              totalFat: acc.totalFat + (entry.fat || 0),
            }),
            { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 }
          );
          return {
            date,
            entries: dayEntries.sort((a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            ),
            stats,
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      app.logger.info({ userId: session.user.id, days: actualDays, count: result.length }, 'Food entries history retrieved');
      return result;
    }
  );

  // GET /api/food-entries/stats/date/:date - Stats for specific date
  app.fastify.get<{ Params: { date: string } }>(
    '/api/food-entries/stats/date/:date',
    {
      schema: {
        description: 'Get food statistics for a specific date (YYYY-MM-DD)',
        tags: ['food-entries'],
        params: {
          type: 'object',
          required: ['date'],
          properties: {
            date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              totalCalories: { type: 'number' },
              totalProtein: { type: 'number' },
              totalCarbs: { type: 'number' },
              totalFat: { type: 'number' },
              entryCount: { type: 'number' },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          400: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { date: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { date } = request.params;

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        app.logger.warn({ userId: session.user.id, date }, 'Invalid date format');
        return reply.status(400).send({ error: 'Invalid date format. Use YYYY-MM-DD' });
      }

      app.logger.info({ userId: session.user.id, date }, 'Fetching stats for specific date');

      // Parse date and get start/end of day
      const [year, month, day] = date.split('-').map(Number);
      const startOfDay = new Date(year, month - 1, day);
      const endOfDay = new Date(year, month - 1, day + 1);

      const entries = await app.db
        .select()
        .from(schema.foodEntries)
        .where(
          and(
            eq(schema.foodEntries.userId, session.user.id),
            gte(schema.foodEntries.createdAt, startOfDay),
            lt(schema.foodEntries.createdAt, endOfDay)
          )
        );

      const stats = entries.reduce(
        (acc, entry) => ({
          totalCalories: acc.totalCalories + entry.calories,
          totalProtein: acc.totalProtein + (entry.protein || 0),
          totalCarbs: acc.totalCarbs + (entry.carbs || 0),
          totalFat: acc.totalFat + (entry.fat || 0),
          entryCount: acc.entryCount + 1,
        }),
        { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, entryCount: 0 }
      );

      app.logger.info({ userId: session.user.id, date, stats }, 'Date statistics retrieved');
      return stats;
    }
  );

  // POST /api/food-entries - Create a food entry
  app.fastify.post<{ Body: CreateFoodEntryBody }>(
    '/api/food-entries',
    {
      schema: {
        description: 'Create a new food entry for the authenticated user',
        tags: ['food-entries'],
        body: {
          type: 'object',
          required: ['foodName', 'calories'],
          properties: {
            foodName: { type: 'string' },
            calories: { type: 'number' },
            protein: { type: 'number' },
            carbs: { type: 'number' },
            fat: { type: 'number' },
            mealType: { type: 'string' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              userId: { type: 'string' },
              foodName: { type: 'string' },
              calories: { type: 'number' },
              protein: { type: ['number', 'null'] },
              carbs: { type: ['number', 'null'] },
              fat: { type: ['number', 'null'] },
              mealType: { type: ['string', 'null'] },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateFoodEntryBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { foodName, calories, protein, carbs, fat, mealType } = request.body;
      app.logger.info(
        { userId: session.user.id, foodName, calories },
        'Creating food entry'
      );

      const newEntry = await app.db
        .insert(schema.foodEntries)
        .values({
          userId: session.user.id,
          foodName,
          calories,
          protein: protein !== undefined ? protein : null,
          carbs: carbs !== undefined ? carbs : null,
          fat: fat !== undefined ? fat : null,
          mealType: mealType !== undefined ? mealType : null,
          createdAt: new Date(),
        })
        .returning();

      app.logger.info(
        { entryId: newEntry[0].id, userId: session.user.id },
        'Food entry created successfully'
      );
      return reply.status(201).send(newEntry[0]);
    }
  );

  // PUT /api/food-entries/:id - Update a food entry
  app.fastify.put<{ Params: { id: string }; Body: UpdateFoodEntryBody }>(
    '/api/food-entries/:id',
    {
      schema: {
        description: 'Update a food entry (only if user owns it)',
        tags: ['food-entries'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            foodName: { type: 'string' },
            calories: { type: 'number' },
            protein: { type: 'number' },
            carbs: { type: 'number' },
            fat: { type: 'number' },
            mealType: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              userId: { type: 'string' },
              foodName: { type: 'string' },
              calories: { type: 'number' },
              protein: { type: ['number', 'null'] },
              carbs: { type: ['number', 'null'] },
              fat: { type: ['number', 'null'] },
              mealType: { type: ['string', 'null'] },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          403: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateFoodEntryBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      app.logger.info(
        { userId: session.user.id, entryId: id },
        'Updating food entry'
      );

      const entry = await app.db
        .select()
        .from(schema.foodEntries)
        .where(eq(schema.foodEntries.id, id))
        .limit(1);

      if (!entry || entry.length === 0) {
        app.logger.warn({ entryId: id }, 'Food entry not found');
        return reply.status(404).send({ error: 'Food entry not found' });
      }

      if (entry[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, entryId: id, ownerId: entry[0].userId },
          'User does not own this food entry'
        );
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { foodName, calories, protein, carbs, fat, mealType } = request.body;

      const updatedEntry = await app.db
        .update(schema.foodEntries)
        .set({
          foodName: foodName !== undefined ? foodName : entry[0].foodName,
          calories: calories !== undefined ? calories : entry[0].calories,
          protein: protein !== undefined ? protein : entry[0].protein,
          carbs: carbs !== undefined ? carbs : entry[0].carbs,
          fat: fat !== undefined ? fat : entry[0].fat,
          mealType: mealType !== undefined ? mealType : entry[0].mealType,
        })
        .where(eq(schema.foodEntries.id, id))
        .returning();

      app.logger.info(
        { entryId: id, userId: session.user.id },
        'Food entry updated successfully'
      );
      return updatedEntry[0];
    }
  );

  // DELETE /api/food-entries/:id - Delete a food entry
  app.fastify.delete<{ Params: { id: string } }>(
    '/api/food-entries/:id',
    {
      schema: {
        description: 'Delete a food entry (only if user owns it)',
        tags: ['food-entries'],
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
            properties: {
              error: { type: 'string' },
            },
          },
          403: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      app.logger.info(
        { userId: session.user.id, entryId: id },
        'Deleting food entry'
      );

      const entry = await app.db
        .select()
        .from(schema.foodEntries)
        .where(eq(schema.foodEntries.id, id))
        .limit(1);

      if (!entry || entry.length === 0) {
        app.logger.warn({ entryId: id }, 'Food entry not found');
        return reply.status(404).send({ error: 'Food entry not found' });
      }

      if (entry[0].userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, entryId: id, ownerId: entry[0].userId },
          'User does not own this food entry'
        );
        return reply.status(403).send({ error: 'Forbidden' });
      }

      await app.db
        .delete(schema.foodEntries)
        .where(eq(schema.foodEntries.id, id));

      app.logger.info(
        { entryId: id, userId: session.user.id },
        'Food entry deleted successfully'
      );
      return { success: true };
    }
  );

  // GET /api/food-entries/progress - Get weekly progress data with BMI statistics
  app.fastify.get('/api/food-entries/progress', {
    schema: {
      description: 'Get weekly progress data and BMI statistics for the authenticated user',
      tags: ['food-entries'],
      response: {
        200: {
          type: 'object',
          properties: {
            thisWeek: {
              type: 'object',
              properties: {
                totalCalories: { type: 'number' },
                totalProtein: { type: 'number' },
                totalCarbs: { type: 'number' },
                totalFat: { type: 'number' },
                dailyCalories: { type: 'array', items: { type: 'number' } },
                days: { type: 'array', items: { type: 'string' } },
              },
            },
            lastWeek: {
              type: 'object',
              properties: {
                totalCalories: { type: 'number' },
                totalProtein: { type: 'number' },
                totalCarbs: { type: 'number' },
                totalFat: { type: 'number' },
                dailyCalories: { type: 'array', items: { type: 'number' } },
                days: { type: 'array', items: { type: 'string' } },
              },
            },
            twoWeeksAgo: {
              type: 'object',
              properties: {
                totalCalories: { type: 'number' },
                totalProtein: { type: 'number' },
                totalCarbs: { type: 'number' },
                totalFat: { type: 'number' },
                dailyCalories: { type: 'array', items: { type: 'number' } },
                days: { type: 'array', items: { type: 'string' } },
              },
            },
            threeWeeksAgo: {
              type: 'object',
              properties: {
                totalCalories: { type: 'number' },
                totalProtein: { type: 'number' },
                totalCarbs: { type: 'number' },
                totalFat: { type: 'number' },
                dailyCalories: { type: 'array', items: { type: 'number' } },
                days: { type: 'array', items: { type: 'string' } },
              },
            },
            bmi: { type: ['number', 'null'] },
            bmiStatus: { type: ['string', 'null'] },
            currentWeight: { type: ['number', 'null'] },
            goalWeight: { type: ['number', 'null'] },
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

    app.logger.info({ userId: session.user.id }, 'Fetching weekly progress data');

    // Helper function to calculate stats for a week (weekOffset: 0 = this week, 1 = last week, etc.)
    const getWeekStats = async (weekOffset: number) => {
      // Calculate start of current week (Sunday)
      const today = new Date();
      const dayOfWeek = today.getDay();
      const startOfThisWeek = new Date(today);
      startOfThisWeek.setDate(today.getDate() - dayOfWeek);
      startOfThisWeek.setHours(0, 0, 0, 0);

      // Calculate start and end of the target week
      const startOfWeek = new Date(startOfThisWeek);
      startOfWeek.setDate(startOfThisWeek.getDate() - (weekOffset * 7));

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      // Get entries for the week
      const entries = await app.db
        .select()
        .from(schema.foodEntries)
        .where(
          and(
            eq(schema.foodEntries.userId, session.user.id),
            gte(schema.foodEntries.createdAt, startOfWeek),
            lt(schema.foodEntries.createdAt, endOfWeek)
          )
        );

      // Initialize daily stats (0 = Sunday, 6 = Saturday)
      const dailyStats: Record<number, { calories: number; protein: number; carbs: number; fat: number }> = {};
      for (let i = 0; i < 7; i++) {
        dailyStats[i] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      }

      // Aggregate entries by day of week
      entries.forEach((entry) => {
        const entryDate = new Date(entry.createdAt);
        const dayIndex = entryDate.getDay();
        dailyStats[dayIndex].calories += entry.calories;
        dailyStats[dayIndex].protein += entry.protein || 0;
        dailyStats[dayIndex].carbs += entry.carbs || 0;
        dailyStats[dayIndex].fat += entry.fat || 0;
      });

      // Calculate totals
      const totalCalories = Object.values(dailyStats).reduce((sum, day) => sum + day.calories, 0);
      const totalProtein = Object.values(dailyStats).reduce((sum, day) => sum + day.protein, 0);
      const totalCarbs = Object.values(dailyStats).reduce((sum, day) => sum + day.carbs, 0);
      const totalFat = Object.values(dailyStats).reduce((sum, day) => sum + day.fat, 0);

      // Build daily calories array (0=Sun, 1=Mon, ..., 6=Sat)
      const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dailyCalories = dayLabels.map((_, i) => dailyStats[i].calories);

      return {
        totalCalories,
        totalProtein,
        totalCarbs,
        totalFat,
        dailyCalories,
        days: dayLabels,
      };
    };

    // Get stats for all 4 weeks in parallel
    const [thisWeek, lastWeek, twoWeeksAgo, threeWeeksAgo] = await Promise.all([
      getWeekStats(0),
      getWeekStats(1),
      getWeekStats(2),
      getWeekStats(3),
    ]);

    // Get user profile for BMI calculation
    const profile = await app.db
      .select()
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, session.user.id))
      .limit(1);

    let bmi: number | null = null;
    let bmiStatus: string | null = null;
    let currentWeight: number | null = null;
    let goalWeight: number | null = null;

    if (profile.length > 0 && profile[0].heightCm && profile[0].weightKg) {
      const heightMeters = profile[0].heightCm / 100;
      bmi = Math.round((profile[0].weightKg / (heightMeters * heightMeters)) * 10) / 10;
      currentWeight = profile[0].weightKg;

      // Determine BMI status
      if (bmi < 18.5) {
        bmiStatus = 'Underweight';
      } else if (bmi < 25) {
        bmiStatus = 'Healthy';
      } else if (bmi < 30) {
        bmiStatus = 'Overweight';
      } else {
        bmiStatus = 'Obese';
      }

      // goalWeight is not stored in the schema, return null
      goalWeight = null;
    }

    app.logger.info(
      { userId: session.user.id, bmi, bmiStatus },
      'Weekly progress data retrieved'
    );

    return {
      thisWeek,
      lastWeek,
      twoWeeksAgo,
      threeWeeksAgo,
      bmi,
      bmiStatus,
      currentWeight,
      goalWeight,
    };
  });
}

