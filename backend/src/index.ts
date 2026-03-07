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

// Auto-seed food database on startup if empty
async function seedFoodDatabase() {
  try {
    const existing = await app.db
      .select()
      .from(appSchema.foodDatabase)
      .limit(1);

    if (existing.length > 0) {
      app.logger.info('Food database already populated, skipping seed');
      return;
    }

    const foodData = [
      // INDIAN FOODS
      { name: 'Biryani (Chicken)', category: 'indian', cal: 195, protein: 12, carbs: 28, fat: 4.5, serving: 250, aliases: ['chicken biryani', 'biryani rice', 'biriyani'] },
      { name: 'Butter Chicken', category: 'indian', cal: 180, protein: 15, carbs: 8, fat: 10, serving: 200, aliases: ['murgh makhani', 'butter chicken curry', 'chicken makhani'] },
      { name: 'Samosa (potato)', category: 'indian', cal: 280, protein: 5, carbs: 30, fat: 15, serving: 100, aliases: ['aloo samosa', 'samosa', 'potato samosa'] },
      { name: 'Bhujia', category: 'indian', cal: 520, protein: 12, carbs: 50, fat: 28, serving: 100, aliases: ['bhujiya', 'namkeen bhujia', 'snack bhujia'] },
      { name: 'Sev (murukku)', category: 'indian', cal: 490, protein: 10, carbs: 45, fat: 28, serving: 100, aliases: ['sev', 'murukku', 'sev snack'] },
      { name: 'Dosa (plain)', category: 'indian', cal: 150, protein: 8, carbs: 20, fat: 4, serving: 150, aliases: ['masala dosa', 'rice dosa', 'plain dosa', 'dosai'] },
      { name: 'Idli', category: 'indian', cal: 90, protein: 3, carbs: 17, fat: 1, serving: 100, aliases: ['idly', 'south indian idli', 'rice cake'] },
      { name: 'Gulab Jamun', category: 'indian', cal: 280, protein: 4, carbs: 35, fat: 15, serving: 100, aliases: ['gulab jamun dessert', 'gulab jamun sweet'] },
      { name: 'Paneer Tikka', category: 'indian', cal: 190, protein: 18, carbs: 6, fat: 11, serving: 150, aliases: ['cottage cheese tikka', 'paneer tikka appetizer'] },
      { name: 'Naan (plain)', category: 'indian', cal: 260, protein: 8, carbs: 44, fat: 6, serving: 100, aliases: ['tandoori naan', 'naan bread', 'plain naan'] },
      { name: 'Roti', category: 'indian', cal: 70, protein: 3, carbs: 14, fat: 0.5, serving: 50, aliases: ['chapati', 'indian bread', 'wheat roti'] },
      { name: 'Dal (lentil curry)', category: 'indian', cal: 110, protein: 8, carbs: 18, fat: 1.5, serving: 200, aliases: ['lentil curry', 'toor dal', 'moong dal', 'dal fry'] },
      { name: 'Pakora (vegetable)', category: 'indian', cal: 270, protein: 8, carbs: 25, fat: 15, serving: 100, aliases: ['vegetable pakora', 'fritters', 'pakora snack'] },
      { name: 'Jalebi', category: 'indian', cal: 270, protein: 3, carbs: 65, fat: 2, serving: 100, aliases: ['jilebi', 'spiraled sweet', 'jalebi sweet'] },
      { name: 'Rasgulla', category: 'indian', cal: 150, protein: 4, carbs: 33, fat: 1, serving: 100, aliases: ['rasgulla dessert', 'sponge cake', 'rasgulla sweet'] },
      { name: 'Chicken Curry', category: 'indian', cal: 165, protein: 20, carbs: 5, fat: 8, serving: 200, aliases: ['murgh curry', 'spiced chicken', 'chicken gravy'] },
      { name: 'Chole Bhature', category: 'indian', cal: 380, protein: 14, carbs: 45, fat: 16, serving: 250, aliases: ['chickpea curry with bread', 'chhole bhature', 'chole bhature'] },
      { name: 'Tandoori Chicken', category: 'indian', cal: 165, protein: 22, carbs: 0, fat: 8, serving: 150, aliases: ['tandoori murgh', 'grilled chicken', 'tandoori'] },
      { name: 'Aloo Gobi', category: 'indian', cal: 120, protein: 4, carbs: 18, fat: 4, serving: 200, aliases: ['potato cauliflower curry', 'aloo gobi curry'] },

      // FAST FOOD
      { name: 'Hamburger', category: 'fast_food', cal: 540, protein: 30, carbs: 41, fat: 28, serving: 215, aliases: ['burger', 'beef burger', 'hamburger fast food'] },
      { name: 'Cheeseburger', category: 'fast_food', cal: 600, protein: 33, carbs: 41, fat: 34, serving: 230, aliases: ['cheese burger', 'cheeseburg'] },
      { name: 'Pizza (cheese, 1 slice)', category: 'fast_food', cal: 285, protein: 12, carbs: 36, fat: 10, serving: 100, aliases: ['cheese pizza', 'margherita pizza', 'pizza cheese'] },
      { name: 'Pizza (pepperoni, 1 slice)', category: 'fast_food', cal: 310, protein: 13, carbs: 36, fat: 14, serving: 110, aliases: ['pepperoni pizza', 'pizza pepperoni'] },
      { name: 'French Fries (medium)', category: 'fast_food', cal: 320, protein: 4, carbs: 41, fat: 15, serving: 115, aliases: ['fries', 'chips', 'french fries'] },
      { name: 'Chicken Nuggets (6 pieces)', category: 'fast_food', cal: 280, protein: 18, carbs: 15, fat: 16, serving: 100, aliases: ['chicken nuggets', 'nuggets'] },
      { name: 'Fried Chicken (drumstick)', category: 'fast_food', cal: 195, protein: 17, carbs: 7, fat: 11, serving: 100, aliases: ['fried drumstick', 'fried chicken'] },
      { name: 'Chicken Sandwich', category: 'fast_food', cal: 480, protein: 27, carbs: 38, fat: 24, serving: 180, aliases: ['chicken burger', 'grilled chicken sandwich', 'chicken sandwich'] },
      { name: 'Hotdog', category: 'fast_food', cal: 290, protein: 10, carbs: 22, fat: 17, serving: 100, aliases: ['hot dog', 'frankfurter', 'hotdog'] },
      { name: 'Taco (beef)', category: 'fast_food', cal: 170, protein: 9, carbs: 13, fat: 9, serving: 75, aliases: ['beef taco', 'taco'] },
      { name: 'Burrito (chicken)', category: 'fast_food', cal: 420, protein: 17, carbs: 47, fat: 18, serving: 230, aliases: ['chicken burrito', 'burrito'] },
      { name: 'Wrap (chicken)', category: 'fast_food', cal: 380, protein: 22, carbs: 40, fat: 16, serving: 220, aliases: ['chicken wrap', 'wrap'] },

      // BEVERAGES
      { name: 'Cola (regular, 250ml)', category: 'beverage', cal: 105, protein: 0, carbs: 29, fat: 0, serving: 250, aliases: ['coke', 'soda', 'cola', 'cola drink'] },
      { name: 'Orange Juice (250ml)', category: 'beverage', cal: 110, protein: 2, carbs: 26, fat: 0.5, serving: 250, aliases: ['oj', 'orange juice', 'juice'] },
      { name: 'Apple Juice (250ml)', category: 'beverage', cal: 115, protein: 0.5, carbs: 28, fat: 0.3, serving: 250, aliases: ['apple juice'] },
      { name: 'Milk (whole, 250ml)', category: 'beverage', cal: 160, protein: 8, carbs: 12, fat: 9, serving: 250, aliases: ['whole milk', 'milk'] },
      { name: 'Skim Milk (250ml)', category: 'beverage', cal: 85, protein: 8.5, carbs: 12, fat: 0.5, serving: 250, aliases: ['low-fat milk', 'skim milk'] },
      { name: 'Smoothie (mixed berry)', category: 'beverage', cal: 220, protein: 6, carbs: 45, fat: 1.5, serving: 250, aliases: ['berry smoothie', 'fruit smoothie', 'smoothie'] },
      { name: 'Coffee (black, 250ml)', category: 'beverage', cal: 5, protein: 0.3, carbs: 0.5, fat: 0, serving: 250, aliases: ['black coffee', 'coffee'] },
      { name: 'Latte (250ml)', category: 'beverage', cal: 120, protein: 6, carbs: 10, fat: 6, serving: 250, aliases: ['cappuccino', 'latte'] },
      { name: 'Tea (black, 250ml)', category: 'beverage', cal: 2, protein: 0.5, carbs: 0, fat: 0, serving: 250, aliases: ['black tea', 'tea'] },
      { name: 'Green Tea (250ml)', category: 'beverage', cal: 2, protein: 0.5, carbs: 0, fat: 0, serving: 250, aliases: ['green tea'] },
      { name: 'Lassi (yogurt drink)', category: 'beverage', cal: 145, protein: 5, carbs: 18, fat: 4, serving: 250, aliases: ['sweet lassi', 'yogurt lassi', 'lassi'] },
      { name: 'Milkshake (vanilla, 250ml)', category: 'beverage', cal: 260, protein: 7, carbs: 38, fat: 8, serving: 250, aliases: ['vanilla shake', 'milkshake'] },

      // ICE CREAM
      { name: 'Vanilla Ice Cream', category: 'ice_cream', cal: 207, protein: 4, carbs: 24, fat: 11, serving: 100, aliases: ['vanilla ice cream', 'plain vanilla', 'ice cream vanilla', 'vanilla', 'icecream'] },
      { name: 'Chocolate Ice Cream', category: 'ice_cream', cal: 216, protein: 4, carbs: 26, fat: 12, serving: 100, aliases: ['chocolate ice cream', 'chocolate', 'choco ice cream'] },
      { name: 'Strawberry Ice Cream', category: 'ice_cream', cal: 200, protein: 3.5, carbs: 25, fat: 10, serving: 100, aliases: ['strawberry ice cream', 'strawberry flavor', 'strawberry'] },
      { name: 'Mango Ice Cream', category: 'ice_cream', cal: 195, protein: 3, carbs: 27, fat: 9, serving: 100, aliases: ['mango ice cream', 'mango kulfi', 'mango'] },
      { name: 'Butterscotch Ice Cream', category: 'ice_cream', cal: 220, protein: 4, carbs: 28, fat: 11, serving: 100, aliases: ['butterscotch flavor', 'butterscotch'] },
      { name: 'Mint Chocolate Ice Cream', category: 'ice_cream', cal: 210, protein: 4, carbs: 25, fat: 12, serving: 100, aliases: ['mint choco', 'mint chocolate', 'mint choc'] },
      { name: 'Cookie Dough Ice Cream', category: 'ice_cream', cal: 240, protein: 4, carbs: 28, fat: 14, serving: 100, aliases: ['cookie dough', 'cookie dough ice cream'] },
      { name: 'Pistachio Ice Cream', category: 'ice_cream', cal: 210, protein: 5, carbs: 22, fat: 12, serving: 100, aliases: ['pistachio flavor', 'pistachio'] },

      // DESSERTS
      { name: 'Chocolate Cake (slice)', category: 'dessert', cal: 235, protein: 3, carbs: 34, fat: 10, serving: 100, aliases: ['chocolate cake', 'cake slice', 'chocolate layer cake'] },
      { name: 'Vanilla Cake (slice)', category: 'dessert', cal: 220, protein: 2.5, carbs: 32, fat: 9, serving: 100, aliases: ['vanilla cake', 'cake'] },
      { name: 'Cheesecake (slice)', category: 'dessert', cal: 280, protein: 5, carbs: 24, fat: 19, serving: 100, aliases: ['cheese cake', 'cheesecake'] },
      { name: 'Brownie', category: 'dessert', cal: 280, protein: 3, carbs: 37, fat: 14, serving: 100, aliases: ['chocolate brownie', 'fudge brownie', 'brownie'] },
      { name: 'Chocolate Chip Cookie', category: 'dessert', cal: 210, protein: 2.5, carbs: 28, fat: 10, serving: 50, aliases: ['cookie', 'choco chip cookie', 'chocolate chip'] },
      { name: 'Donut (glazed)', category: 'dessert', cal: 260, protein: 4, carbs: 31, fat: 14, serving: 80, aliases: ['glazed donut', 'doughnut', 'donut'] },
      { name: 'Donut (chocolate)', category: 'dessert', cal: 290, protein: 4, carbs: 37, fat: 15, serving: 80, aliases: ['chocolate donut', 'chocolate doughnut'] },
      { name: 'Croissant', category: 'dessert', cal: 430, protein: 9, carbs: 38, fat: 24, serving: 100, aliases: ['butter croissant', 'croissant'] },
      { name: 'Pastry (Danish)', category: 'dessert', cal: 420, protein: 8, carbs: 40, fat: 24, serving: 100, aliases: ['danish pastry', 'pastry'] },
      { name: 'Mousse (chocolate)', category: 'dessert', cal: 195, protein: 5, carbs: 18, fat: 12, serving: 100, aliases: ['chocolate mousse', 'mousse'] },
    ];

    app.logger.info({ itemCount: foodData.length }, 'Starting food database seed');

    for (const food of foodData) {
      await app.db
        .insert(appSchema.foodDatabase)
        .values({
          name: food.name,
          category: food.category,
          caloriesPer100g: food.cal,
          proteinPer100g: food.protein,
          carbsPer100g: food.carbs,
          fatPer100g: food.fat,
          servingSizeG: food.serving,
          aliases: food.aliases,
          description: null,
        });
    }

    app.logger.info({ itemCount: foodData.length }, 'Food database seeded successfully');
  } catch (error) {
    app.logger.error({ err: error }, 'Failed to auto-seed food database');
  }
}

// Enable authentication with Better Auth
app.withAuth();

// Enable storage for file uploads
app.withStorage();

// Auto-seed food database
await seedFoodDatabase();

// Register routes
registerFoodEntryRoutes(app);
registerUserProfileRoutes(app);
registerUsageRoutes(app);
registerGroupRoutes(app);
registerInvitationRoutes(app);
registerNotificationRoutes(app);

await app.run();
app.logger.info('Application running');
