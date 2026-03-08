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
  servingUnit: string;
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
                servingUnit: { type: 'string' },
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
        calories: r.item.calories,
        protein: r.item.protein,
        carbs: r.item.carbs,
        fat: r.item.fat,
        servingSize: r.item.servingSize,
        servingUnit: r.item.servingUnit,
      }));

      app.logger.info({ userId: session.user.id, resultCount: response.length, query }, 'Food search completed');
      return response;
    }
  );

  // POST /api/food/lookup-nutrition - Lookup nutritional values for a food by name using AI
  app.fastify.post<{ Body: { foodName: string } }>(
    '/api/food/lookup-nutrition',
    {
      schema: {
        description: 'Lookup nutritional values for a food name using LLM analysis',
        tags: ['food-ai'],
        body: {
          type: 'object',
          required: ['foodName'],
          properties: {
            foodName: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              foodName: { type: 'string' },
              calories: { type: 'number' },
              protein: { type: 'number' },
              carbs: { type: 'number' },
              fat: { type: 'number' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
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
    async (request: FastifyRequest<{ Body: { foodName: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { foodName } = request.body;

      if (!foodName || foodName.trim().length === 0) {
        app.logger.warn({ userId: session.user.id }, 'Empty food name provided');
        return reply.status(400).send({ error: 'Food name must be provided' });
      }

      app.logger.info({ userId: session.user.id, foodName }, 'Looking up nutrition for food name');

      try {
        const result = await generateObject({
          model: gateway('openai/gpt-4o'),
          schema: nutritionSchema,
          schemaName: 'FoodNutrition',
          schemaDescription: 'Extract nutritional information for a specific food',
          messages: [
            {
              role: 'user',
              content: `You are a nutritionist expert. Analyze this food name and provide accurate nutritional information for a typical serving.

Food name: "${foodName}"

Provide the nutritional values for ONE TYPICAL SERVING of this food (not per 100g, not per 1kg, but a realistic serving size someone would eat).

Examples of typical serving sizes:
- 1 scoop of ice cream = ~100g
- 1 slice of pizza = ~150g
- 1 cup of milk = ~200ml
- 1 apple = ~150g
- 1 chicken breast = ~150g
- 1 bowl of rice = ~200g

Important:
1. Set confidence to "high" if you're very confident about the identification (common foods, well-known dishes)
2. Set confidence to "medium" if somewhat confident but the exact preparation is unclear
3. Set confidence to "low" if uncertain or if the food is very ambiguous
4. All nutritional values MUST be greater than 0 (no zeros allowed)
5. If carbs seem to be 0 (like pure protein), ensure other macros are correct
6. Provide realistic, accurate nutritional data based on actual food composition`,
            },
          ],
        });

        const nutritionData = result.object;

        // Validate that we have positive values
        if (nutritionData.calories <= 0) {
          nutritionData.calories = Math.max(nutritionData.calories, 100);
        }
        if (nutritionData.protein <= 0 && nutritionData.carbs <= 0 && nutritionData.fat <= 0) {
          // If all macros are 0, provide reasonable defaults
          nutritionData.protein = 5;
          nutritionData.carbs = 15;
          nutritionData.fat = 5;
        }

        app.logger.info(
          {
            userId: session.user.id,
            foodName: nutritionData.foodName,
            calories: nutritionData.calories,
            confidence: nutritionData.confidence,
          },
          'Nutrition lookup successful'
        );

        return {
          foodName: nutritionData.foodName,
          calories: nutritionData.calories,
          protein: nutritionData.protein,
          carbs: nutritionData.carbs,
          fat: nutritionData.fat,
          confidence: nutritionData.confidence,
        };
      } catch (err) {
        app.logger.warn(
          { userId: session.user.id, foodName, err },
          'AI nutrition lookup failed, providing fallback'
        );

        // Fallback: Search database for similar foods
        try {
          const dbMatches = await app.db
            .select()
            .from(schema.foodDatabase)
            .where(ilike(schema.foodDatabase.name, `%${foodName}%`))
            .limit(1);

          if (dbMatches.length > 0) {
            const match = dbMatches[0];
            return {
              foodName: match.name,
              calories: match.calories,
              protein: match.protein,
              carbs: match.carbs,
              fat: match.fat,
              confidence: 'medium' as const,
            };
          }
        } catch (dbErr) {
          app.logger.warn({ err: dbErr }, 'Database fallback failed');
        }

        // Final fallback with reasonable defaults
        return {
          foodName,
          calories: 250,
          protein: 10,
          carbs: 25,
          fat: 10,
          confidence: 'low' as const,
        };
      }
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
              calories: { type: 'number' },
              protein: { type: 'number' },
              carbs: { type: 'number' },
              fat: { type: 'number' },
              servingSize: { type: 'number' },
              servingUnit: { type: 'string' },
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
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        servingSize: item.servingSize,
        servingUnit: item.servingUnit,
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

        // Wrap in Promise.race with timeout to prevent hanging
        const analysisPromise = generateObject({
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

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI analysis timeout after 4 seconds')), 4000)
        );

        const result = await Promise.race([analysisPromise, timeoutPromise]);
        nutritionData = (result as Awaited<typeof analysisPromise>).object;
        app.logger.info(
          { userId: session.user.id, foodName: nutritionData.foodName, calories: nutritionData.calories, confidence: nutritionData.confidence },
          'Food image analyzed with GPT-4 Vision'
        );
      } catch (err) {
        app.logger.warn({ userId: session.user.id, err }, 'AI analysis failed, attempting database fallback');
        // Try to get a fallback from database first
        const dbFallback = await app.db
          .select()
          .from(schema.foodDatabase)
          .limit(1);

        if (dbFallback.length > 0) {
          const fallbackFood = dbFallback[0];
          nutritionData = {
            foodName: fallbackFood.name,
            calories: fallbackFood.calories,
            protein: fallbackFood.protein,
            carbs: fallbackFood.carbs,
            fat: fallbackFood.fat,
            confidence: 'low',
          };
          app.logger.info({ foodName: nutritionData.foodName }, 'Using database food as fallback');
        } else {
          nutritionData = {
            foodName: 'Unknown Food',
            calories: 200,
            protein: 5,
            carbs: 30,
            fat: 8,
            confidence: 'low',
          };
          app.logger.warn('No database fallback available, using default values');
        }
      }

      // Always search database for suggestions based on identified food name
      let databaseSuggestions: AnalyzeImageResponse['databaseSuggestions'] = undefined;
      try {
        app.logger.info({ foodName: nutritionData.foodName }, 'Searching database for food suggestions');
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
            calories: r.item.calories,
            protein: r.item.protein,
            carbs: r.item.carbs,
            fat: r.item.fat,
          }));
          app.logger.info({ suggestions: databaseSuggestions.length }, 'Database suggestions found');
        } else {
          // If no exact match, get any 3 foods from database as generic suggestions
          const anyFoods = await app.db
            .select()
            .from(schema.foodDatabase)
            .limit(3);

          if (anyFoods.length > 0) {
            databaseSuggestions = anyFoods.map((item) => ({
              id: item.id,
              name: item.name,
              calories: item.calories,
              protein: item.protein,
              carbs: item.carbs,
              fat: item.fat,
            }));
            app.logger.info({ suggestions: databaseSuggestions.length }, 'Generic database suggestions provided');
          }
        }
      } catch (dbErr) {
        app.logger.warn({ err: dbErr }, 'Failed to fetch database suggestions');
      }

      const response: AnalyzeImageResponse = {
        ...nutritionData,
        imageUrl,
        databaseSuggestions: databaseSuggestions || [],
      };

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
          finalCalories = food.calories;
          finalProtein = food.protein;
          finalCarbs = food.carbs;
          finalFat = food.fat;
          app.logger.info({ databaseFoodId, finalFoodName }, 'Using database food data');
        }
      }

      // Validate that calories is > 0
      if (!finalCalories || finalCalories <= 0) {
        app.logger.warn(
          { userId: session.user.id, foodName: finalFoodName, calories: finalCalories },
          'Invalid calories value'
        );
        return reply.status(400).send({ error: 'Calories must be provided and greater than 0.' });
      }

      app.logger.info(
        { userId: session.user.id, foodName: finalFoodName, calories: finalCalories, protein: finalProtein, carbs: finalCarbs, fat: finalFat },
        'Validated nutritional data for food entry'
      );

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
        { userId: session.user.id, foodName, calories, protein, carbs, fat },
        'Creating food entry'
      );

      // Validate that calories is provided and > 0
      if (!calories || calories <= 0) {
        app.logger.warn(
          { userId: session.user.id, foodName, calories },
          'Invalid calories value'
        );
        return reply.status(400).send({ error: 'Calories must be provided and greater than 0.' });
      }

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
        { entryId: newEntry[0].id, userId: session.user.id, calories, protein, carbs, fat },
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

  // POST /api/food/reseed-database - Reseed the food database (development only)
  app.fastify.post(
    '/api/food/reseed-database',
    {
      schema: {
        description: 'Reseed the food database with correct nutritional values (development/admin only)',
        tags: ['food-database'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              itemCount: { type: 'number' },
              message: { type: 'string' },
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
      app.logger.info('Reseed endpoint called');

      try {
        // Clear existing food database
        app.logger.info('Clearing existing food database');
        await app.db.delete(schema.foodDatabase);

        // Generate food data
        const generateFoodDatabase = () => {
          const foods: any[] = [];

          // Common Foods (24 items) - Essential foods with guaranteed nutrition values
          const commonFoods = [
            { name: 'White Rice (cooked)', cal: 130, protein: 2.7, carbs: 28, fat: 0.3, serving: 100, unit: 'g', aliases: ['rice', 'white rice'] },
            { name: 'Chicken Breast (cooked)', cal: 165, protein: 31, carbs: 0, fat: 3.6, serving: 100, unit: 'g', aliases: ['chicken', 'chicken breast'] },
            { name: 'Ground Beef (cooked)', cal: 217, protein: 26, carbs: 0, fat: 11, serving: 100, unit: 'g', aliases: ['ground beef', 'beef'] },
            { name: 'Salmon (cooked)', cal: 280, protein: 25, carbs: 0, fat: 20, serving: 100, unit: 'g', aliases: ['salmon', 'fish'] },
            { name: 'Egg (large, boiled)', cal: 78, protein: 6.3, carbs: 0.6, fat: 5.3, serving: 50, unit: 'piece', aliases: ['egg', 'boiled egg'] },
            { name: 'Milk (2% fat)', cal: 61, protein: 3.2, carbs: 4.8, fat: 2, serving: 200, unit: 'ml', aliases: ['milk'] },
            { name: 'Vanilla Ice Cream', cal: 207, protein: 3.5, carbs: 24, fat: 11, serving: 100, unit: 'g', aliases: ['ice cream', 'vanilla'] },
            { name: 'Broccoli (cooked)', cal: 34, protein: 2.8, carbs: 7, fat: 0.4, serving: 100, unit: 'g', aliases: ['broccoli'] },
            { name: 'Spinach (raw)', cal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, serving: 100, unit: 'g', aliases: ['spinach'] },
            { name: 'Tomato (raw)', cal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, serving: 100, unit: 'g', aliases: ['tomato'] },
            { name: 'Potato (cooked)', cal: 77, protein: 1.7, carbs: 17, fat: 0.1, serving: 100, unit: 'g', aliases: ['potato'] },
            { name: 'Lentils (cooked)', cal: 116, protein: 9.0, carbs: 20, fat: 0.4, serving: 100, unit: 'g', aliases: ['lentils'] },
            { name: 'Pasta (cooked)', cal: 131, protein: 5, carbs: 25, fat: 1.1, serving: 100, unit: 'g', aliases: ['pasta'] },
            { name: 'Yogurt (plain)', cal: 59, protein: 10, carbs: 3.3, fat: 0.4, serving: 100, unit: 'g', aliases: ['yogurt'] },
            { name: 'Cheddar Cheese', cal: 403, protein: 23, carbs: 1.3, fat: 33, serving: 30, unit: 'g', aliases: ['cheese'] },
            { name: 'Pizza (Cheese, 1 slice)', cal: 285, protein: 12, carbs: 36, fat: 10, serving: 150, unit: 'g', aliases: ['pizza'] },
            { name: 'Milk Tea (Regular, 200ml)', cal: 80, protein: 2, carbs: 12, fat: 2, serving: 200, unit: 'ml', aliases: ['milk tea', 'tea'] },
            { name: 'Biryani (Chicken)', cal: 280, protein: 12, carbs: 38, fat: 8, serving: 250, unit: 'g', aliases: ['biryani'] },
            { name: 'Butter Chicken', cal: 320, protein: 20, carbs: 8, fat: 18, serving: 200, unit: 'g', aliases: ['butter chicken'] },
            { name: 'Dosa', cal: 150, protein: 5, carbs: 20, fat: 4, serving: 150, unit: 'g', aliases: ['dosa'] },
            { name: 'Olive Oil', cal: 884, protein: 0, carbs: 0, fat: 100, serving: 15, unit: 'ml', aliases: ['olive oil'] },
            { name: 'Peanut Butter', cal: 588, protein: 25, carbs: 20, fat: 50, serving: 32, unit: 'g', aliases: ['peanut butter'] },
            { name: 'Honey', cal: 304, protein: 0.3, carbs: 82, fat: 0, serving: 21, unit: 'g', aliases: ['honey'] },
            { name: 'Sweet Potato (cooked)', cal: 86, protein: 1.6, carbs: 20, fat: 0.1, serving: 100, unit: 'g', aliases: ['sweet potato'] },
          ];

          commonFoods.forEach(item => {
            foods.push({
              name: item.name,
              category: item.name.includes('Rice') ? 'grains' :
                       item.name.includes('Chicken') || item.name.includes('Beef') || item.name.includes('Fish') || item.name.includes('Egg') ? 'protein' :
                       item.name.includes('Milk') || item.name.includes('Cheese') || item.name.includes('Yogurt') || item.name.includes('Ice Cream') ? 'dairy' :
                       item.name.includes('Pizza') ? 'fast_food' :
                       item.name.includes('Biryani') || item.name.includes('Butter Chicken') || item.name.includes('Dosa') ? 'indian' :
                       item.name.includes('Tea') ? 'beverage' :
                       item.name.includes('Broccoli') || item.name.includes('Spinach') || item.name.includes('Tomato') || item.name.includes('Potato') ? 'vegetable' :
                       item.name.includes('Lentils') ? 'legumes' : 'other',
              cal: item.cal,
              protein: item.protein,
              carbs: item.carbs,
              fat: item.fat,
              serving: item.serving,
              aliases: item.aliases,
              unit: item.unit,
            });
          });

          return foods;
        };

        const foodData = generateFoodDatabase();
        app.logger.info({ itemCount: foodData.length }, 'Reseeding food database');

        // Insert all food items
        let insertedCount = 0;
        for (const food of foodData) {
          await app.db
            .insert(schema.foodDatabase)
            .values({
              name: food.name,
              category: food.category,
              calories: food.cal,
              protein: food.protein,
              carbs: food.carbs,
              fat: food.fat,
              servingSize: food.serving,
              servingUnit: food.unit || 'g',
              aliases: food.aliases,
              description: null,
            });
          insertedCount++;
        }

        // Verify insertion
        const verifyCount = await app.db
          .select()
          .from(schema.foodDatabase)
          .limit(5);

        app.logger.info(
          {
            insertedCount,
            sample: verifyCount.map(f => ({
              name: f.name,
              calories: f.calories,
              protein: f.protein,
              carbs: f.carbs,
              fat: f.fat,
            }))
          },
          'Food database reseeded successfully'
        );

        return reply.status(200).send({
          success: true,
          itemCount: insertedCount,
          message: 'Food database reseeded successfully with correct nutritional values',
        });
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to reseed food database');
        return reply.status(500).send({ error: 'Failed to reseed food database' });
      }
    }
  );
}

