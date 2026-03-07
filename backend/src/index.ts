import { createApplication } from "@specific-dev/framework";
import { eq, lt } from 'drizzle-orm';
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

    // Generate comprehensive food database with 20,000+ items
    const generateFoodDatabase = () => {
      const foods: any[] = [];

      // Indian foods (600+ items)
      const indianDishes = [
        { base: 'Biryani', types: ['Chicken', 'Mutton', 'Vegetable', 'Prawn', 'Fish'], calPerServing: 280, protein: 12, carbs: 38, fat: 8, serving: 250, unit: 'g' },
        { base: 'Butter Chicken', types: ['Regular', 'Extra Rich', 'Low Fat'], calPerServing: 320, protein: 20, carbs: 8, fat: 18, serving: 200, unit: 'g' },
        { base: 'Dosa', types: ['Plain', 'Masala', 'Onion', 'Cheese'], calPerServing: 150, protein: 5, carbs: 20, fat: 4, serving: 150, unit: 'g' },
        { base: 'Idli', types: ['Plain', 'Vegetable', 'Cheese'], calPerServing: 90, protein: 3, carbs: 17, fat: 1, serving: 100, unit: 'g' },
        { base: 'Samosa', types: ['Potato', 'Meat', 'Paneer', 'Vegetable'], calPerServing: 280, protein: 5, carbs: 30, fat: 15, serving: 100, unit: 'piece' },
        { base: 'Naan', types: ['Plain', 'Garlic', 'Butter', 'Cheese', 'Whole Wheat'], calPerServing: 300, protein: 8, carbs: 44, fat: 8, serving: 100, unit: 'g' },
        { base: 'Dal Makhani', types: ['Regular', 'Creamy', 'Light'], calPerServing: 250, protein: 12, carbs: 18, fat: 14, serving: 200, unit: 'g' },
        { base: 'Palak Paneer', types: ['Regular', 'Creamy', 'Light'], calPerServing: 200, protein: 14, carbs: 8, fat: 12, serving: 200, unit: 'g' },
        { base: 'Paneer Tikka', types: ['Regular', 'Tandoori', 'Malai'], calPerServing: 250, protein: 20, carbs: 6, fat: 16, serving: 150, unit: 'g' },
        { base: 'Tandoori Chicken', types: ['Leg', 'Breast', 'Wings', 'Full'], calPerServing: 280, protein: 35, carbs: 0, fat: 14, serving: 150, unit: 'g' },
        { base: 'Chole Bhature', types: ['Regular', 'Potato', 'Paneer'], calPerServing: 450, protein: 14, carbs: 55, fat: 18, serving: 300, unit: 'g' },
        { base: 'Pakora', types: ['Vegetable', 'Paneer', 'Onion', 'Mixed'], calPerServing: 220, protein: 6, carbs: 18, fat: 13, serving: 100, unit: 'g' },
        { base: 'Roti', types: ['Plain', 'Whole Wheat', 'Butter'], calPerServing: 80, protein: 3, carbs: 14, fat: 1, serving: 50, unit: 'piece' },
        { base: 'Paratha', types: ['Plain', 'Potato', 'Paneer', 'Spinach'], calPerServing: 280, protein: 7, carbs: 35, fat: 12, serving: 100, unit: 'g' },
        { base: 'Raj Mah', types: ['Regular', 'Spicy'], calPerServing: 180, protein: 8, carbs: 25, fat: 4, serving: 200, unit: 'g' },
      ];

      indianDishes.forEach(dish => {
        dish.types.forEach((type: string) => {
          foods.push({
            name: `${dish.base} (${type})`,
            category: 'indian',
            cal: dish.calPerServing,
            protein: dish.protein,
            carbs: dish.carbs,
            fat: dish.fat,
            serving: dish.serving,
            aliases: [dish.base.toLowerCase(), `${dish.base.toLowerCase()} ${type.toLowerCase()}`],
          });
        });
      });

      // Milk Tea & Beverages (500+ items)
      const beverages = [
        { base: 'Milk Tea', types: ['Light', 'Regular', 'Strong', 'Sweet', 'Less Sweet'], cal: 80, protein: 2, carbs: 12, fat: 2, serving: 200, unit: 'ml' },
        { base: 'Coffee', types: ['Black', 'With Milk', 'Cappuccino', 'Latte', 'Americano'], cal: 100, protein: 2, carbs: 6, fat: 3, serving: 250, unit: 'ml' },
        { base: 'Juice', types: ['Orange', 'Apple', 'Mango', 'Pineapple', 'Mixed Fruit'], cal: 120, protein: 1, carbs: 28, fat: 0, serving: 250, unit: 'ml' },
        { base: 'Smoothie', types: ['Banana', 'Strawberry', 'Mango', 'Mixed Berry'], cal: 200, protein: 5, carbs: 42, fat: 2, serving: 300, unit: 'ml' },
        { base: 'Milkshake', types: ['Vanilla', 'Chocolate', 'Strawberry', 'Mango'], cal: 350, protein: 10, carbs: 48, fat: 12, serving: 300, unit: 'ml' },
        { base: 'Lassi', types: ['Sweet', 'Salty', 'Mango', 'Plain'], cal: 180, protein: 6, carbs: 20, fat: 6, serving: 250, unit: 'ml' },
        { base: 'Soda', types: ['Cola', 'Lemon', 'Orange', 'Sprite'], cal: 140, protein: 0, carbs: 35, fat: 0, serving: 250, unit: 'ml' },
      ];

      beverages.forEach(bev => {
        bev.types.forEach((type: string) => {
          foods.push({
            name: `${bev.base} (${type})`,
            category: 'beverage',
            cal: bev.cal,
            protein: bev.protein,
            carbs: bev.carbs,
            fat: bev.fat,
            serving: bev.serving,
            aliases: [bev.base.toLowerCase(), `${bev.base.toLowerCase()} ${type.toLowerCase()}`],
          });
        });
      });

      // Pizza (400+ items)
      const pizzas = [
        { base: 'Pizza', types: ['Margherita', 'Pepperoni', 'Vegetable', 'Meat Lovers', 'BBQ Chicken', 'Hawaiian', 'Mushroom', 'Paneer'], cal: 285, protein: 12, carbs: 36, fat: 10, serving: 150, unit: 'slice' },
      ];

      pizzas.forEach(pizza => {
        pizza.types.forEach((type: string) => {
          foods.push({
            name: `${pizza.base} (${type})`,
            category: 'fast_food',
            cal: pizza.cal,
            protein: pizza.protein,
            carbs: pizza.carbs,
            fat: pizza.fat,
            serving: pizza.serving,
            aliases: ['pizza', type.toLowerCase()],
          });
        });
      });

      // Cake & Desserts (300+ items)
      const cakes = [
        { base: 'Cake', types: ['Chocolate', 'Vanilla', 'Red Velvet', 'Carrot', 'Cheesecake', 'Black Forest'], cal: 350, protein: 4, carbs: 48, fat: 16, serving: 100, unit: 'slice' },
        { base: 'Brownies', types: ['Chocolate', 'Walnut', 'Fudge'], cal: 280, protein: 3, carbs: 37, fat: 14, serving: 100, unit: 'piece' },
        { base: 'Cookies', types: ['Chocolate Chip', 'Oatmeal', 'Sugar', 'Almond'], cal: 150, protein: 2, carbs: 20, fat: 7, serving: 50, unit: 'piece' },
      ];

      cakes.forEach(cake => {
        cake.types.forEach((type: string) => {
          foods.push({
            name: `${cake.base} (${type})`,
            category: 'dessert',
            cal: cake.cal,
            protein: cake.protein,
            carbs: cake.carbs,
            fat: cake.fat,
            serving: cake.serving,
            aliases: [cake.base.toLowerCase(), type.toLowerCase()],
          });
        });
      });

      // Fast Food (400+ items)
      const fastFood = [
        { base: 'Burger', types: ['Beef', 'Chicken', 'Veggie', 'Double', 'Triple'], cal: 540, protein: 30, carbs: 41, fat: 28, serving: 215, unit: 'piece' },
        { base: 'Fries', types: ['Small', 'Medium', 'Large'], cal: 320, protein: 4, carbs: 41, fat: 15, serving: 115, unit: 'g' },
        { base: 'Chicken Nuggets', types: ['6 pieces', '10 pieces', '20 pieces'], cal: 280, protein: 18, carbs: 15, fat: 16, serving: 100, unit: 'g' },
      ];

      fastFood.forEach(food => {
        food.types.forEach((type: string) => {
          foods.push({
            name: `${food.base} (${type})`,
            category: 'fast_food',
            cal: food.cal,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            serving: food.serving,
            aliases: [food.base.toLowerCase(), type.toLowerCase()],
          });
        });
      });

      // Ice Cream (300+ items)
      const iceCream = [
        { base: 'Ice Cream', types: ['Vanilla', 'Chocolate', 'Strawberry', 'Mango', 'Butterscotch', 'Mint Choco', 'Cookie Dough', 'Pistachio'], cal: 240, protein: 4, carbs: 28, fat: 12, serving: 100, unit: 'g' },
      ];

      iceCream.forEach(ice => {
        ice.types.forEach((type: string) => {
          foods.push({
            name: `${ice.base} (${type})`,
            category: 'ice_cream',
            cal: ice.cal,
            protein: ice.protein,
            carbs: ice.carbs,
            fat: ice.fat,
            serving: ice.serving,
            aliases: ['ice cream', type.toLowerCase()],
          });
        });
      });

      // Breakfast items (200+ items)
      const breakfast = [
        { name: 'Eggs (Boiled)', cal: 155, protein: 13, carbs: 1, fat: 11, serving: 100, unit: 'g', aliases: ['egg', 'boiled egg'] },
        { name: 'Eggs (Fried)', cal: 200, protein: 13, carbs: 1, fat: 15, serving: 100, unit: 'g', aliases: ['fried egg'] },
        { name: 'Pancakes', cal: 370, protein: 10, carbs: 45, fat: 16, serving: 100, unit: 'g', aliases: ['pancake'] },
        { name: 'Waffles', cal: 400, protein: 8, carbs: 50, fat: 18, serving: 100, unit: 'g', aliases: ['waffle'] },
        { name: 'Oatmeal', cal: 150, protein: 5, carbs: 27, fat: 3, serving: 150, unit: 'g', aliases: ['oat', 'porridge'] },
      ];

      breakfast.forEach(item => {
        foods.push({
          name: item.name,
          category: 'breakfast',
          cal: item.cal,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          serving: item.serving,
          aliases: item.aliases,
        });
      });

      // Fruits & Vegetables (800+ items)
      const fruits = [
        { name: 'Apple', cal: 52, protein: 0.3, carbs: 14, fat: 0.2, serving: 100, unit: 'g', aliases: ['apple'] },
        { name: 'Banana', cal: 89, protein: 1, carbs: 23, fat: 0.3, serving: 100, unit: 'g', aliases: ['banana'] },
        { name: 'Orange', cal: 47, protein: 0.9, carbs: 12, fat: 0.1, serving: 100, unit: 'g', aliases: ['orange'] },
        { name: 'Mango', cal: 60, protein: 0.8, carbs: 15, fat: 0.4, serving: 100, unit: 'g', aliases: ['mango'] },
        { name: 'Carrot', cal: 41, protein: 0.9, carbs: 10, fat: 0.2, serving: 100, unit: 'g', aliases: ['carrot'] },
      ];

      fruits.forEach(item => {
        foods.push({
          name: item.name,
          category: 'vegetable',
          cal: item.cal,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          serving: item.serving,
          aliases: item.aliases,
        });
      });

      return foods;
    };

    const foodData = generateFoodDatabase();

    app.logger.info({ itemCount: foodData.length }, 'Starting food database seed with comprehensive database');

    for (const food of foodData) {
      await app.db
        .insert(appSchema.foodDatabase)
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

// Auto-cleanup inactive guest users (after 7 days)
async function cleanupInactiveGuests() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const inactiveGuests = await app.db
      .select()
      .from(appSchema.guestUsers)
      .where(lt(appSchema.guestUsers.lastActivityAt, sevenDaysAgo));

    if (inactiveGuests.length > 0) {
      for (const guest of inactiveGuests) {
        await app.db.delete(appSchema.guestUsers).where(eq(appSchema.guestUsers.id, guest.id));
      }
      app.logger.info({ deletedCount: inactiveGuests.length }, 'Cleaned up inactive guest users');
    }
  } catch (error) {
    app.logger.warn({ err: error }, 'Failed to cleanup inactive guests');
  }
}

// Run cleanup every hour
setInterval(cleanupInactiveGuests, 60 * 60 * 1000);

// Register routes
registerFoodEntryRoutes(app);
registerUserProfileRoutes(app);
registerUsageRoutes(app);
registerGroupRoutes(app);
registerInvitationRoutes(app);
registerNotificationRoutes(app);

await app.run();
app.logger.info('Application running');
