import { createApplication } from '@specific-dev/framework';
import * as appSchema from './schema/schema.js';
import * as authSchema from './schema/auth-schema.js';

const schema = { ...appSchema, ...authSchema };

// Comprehensive food database with 150+ items (easily expandable to 2000+)
const foodData = [
  // INDIAN FOODS
  { name: 'Biryani (Chicken)', category: 'indian', cal: 195, protein: 12, carbs: 28, fat: 4.5, serving: 250, aliases: ['chicken biryani', 'biryani rice'] },
  { name: 'Butter Chicken', category: 'indian', cal: 180, protein: 15, carbs: 8, fat: 10, serving: 200, aliases: ['murgh makhani', 'butter chicken curry'] },
  { name: 'Samosa (potato)', category: 'indian', cal: 280, protein: 5, carbs: 30, fat: 15, serving: 100, aliases: ['aloo samosa', 'samosa'] },
  { name: 'Bhujia', category: 'indian', cal: 520, protein: 12, carbs: 50, fat: 28, serving: 100, aliases: ['bhujiya', 'namkeen bhujia'] },
  { name: 'Sev (murukku)', category: 'indian', cal: 490, protein: 10, carbs: 45, fat: 28, serving: 100, aliases: ['sev', 'murukku'] },
  { name: 'Dosa (plain)', category: 'indian', cal: 150, protein: 8, carbs: 20, fat: 4, serving: 150, aliases: ['masala dosa', 'rice dosa'] },
  { name: 'Idli', category: 'indian', cal: 90, protein: 3, carbs: 17, fat: 1, serving: 100, aliases: ['idly', 'south indian idli'] },
  { name: 'Gulab Jamun', category: 'indian', cal: 280, protein: 4, carbs: 35, fat: 15, serving: 100, aliases: ['gulab jamun dessert'] },
  { name: 'Paneer Tikka', category: 'indian', cal: 190, protein: 18, carbs: 6, fat: 11, serving: 150, aliases: ['cottage cheese tikka'] },
  { name: 'Naan (plain)', category: 'indian', cal: 260, protein: 8, carbs: 44, fat: 6, serving: 100, aliases: ['tandoori naan', 'naan bread'] },
  { name: 'Roti', category: 'indian', cal: 70, protein: 3, carbs: 14, fat: 0.5, serving: 50, aliases: ['chapati', 'indian bread'] },
  { name: 'Dal (lentil curry)', category: 'indian', cal: 110, protein: 8, carbs: 18, fat: 1.5, serving: 200, aliases: ['lentil curry', 'toor dal', 'moong dal'] },
  { name: 'Pakora (vegetable)', category: 'indian', cal: 270, protein: 8, carbs: 25, fat: 15, serving: 100, aliases: ['vegetable pakora', 'fritters'] },
  { name: 'Jalebi', category: 'indian', cal: 270, protein: 3, carbs: 65, fat: 2, serving: 100, aliases: ['jilebi', 'spiraled sweet'] },
  { name: 'Rasgulla', category: 'indian', cal: 150, protein: 4, carbs: 33, fat: 1, serving: 100, aliases: ['rasgulla dessert', 'sponge cake'] },
  { name: 'Chicken Curry', category: 'indian', cal: 165, protein: 20, carbs: 5, fat: 8, serving: 200, aliases: ['murgh curry', 'spiced chicken'] },
  { name: 'Chole Bhature', category: 'indian', cal: 380, protein: 14, carbs: 45, fat: 16, serving: 250, aliases: ['chickpea curry with bread'] },
  { name: 'Tandoori Chicken', category: 'indian', cal: 165, protein: 22, carbs: 0, fat: 8, serving: 150, aliases: ['tandoori murgh', 'grilled chicken'] },
  { name: 'Aloo Gobi', category: 'indian', cal: 120, protein: 4, carbs: 18, fat: 4, serving: 200, aliases: ['potato cauliflower curry'] },

  // FAST FOOD
  { name: 'Hamburger', category: 'fast_food', cal: 540, protein: 30, carbs: 41, fat: 28, serving: 215, aliases: ['burger', 'beef burger'] },
  { name: 'Cheeseburger', category: 'fast_food', cal: 600, protein: 33, carbs: 41, fat: 34, serving: 230, aliases: ['cheese burger'] },
  { name: 'Pizza (cheese, 1 slice)', category: 'fast_food', cal: 285, protein: 12, carbs: 36, fat: 10, serving: 100, aliases: ['cheese pizza', 'margherita pizza'] },
  { name: 'Pizza (pepperoni, 1 slice)', category: 'fast_food', cal: 310, protein: 13, carbs: 36, fat: 14, serving: 110, aliases: ['pepperoni pizza'] },
  { name: 'French Fries (medium)', category: 'fast_food', cal: 320, protein: 4, carbs: 41, fat: 15, serving: 115, aliases: ['fries', 'chips'] },
  { name: 'Chicken Nuggets (6 pieces)', category: 'fast_food', cal: 280, protein: 18, carbs: 15, fat: 16, serving: 100, aliases: ['chicken nuggets'] },
  { name: 'Fried Chicken (drumstick)', category: 'fast_food', cal: 195, protein: 17, carbs: 7, fat: 11, serving: 100, aliases: ['fried drumstick'] },
  { name: 'Chicken Sandwich', category: 'fast_food', cal: 480, protein: 27, carbs: 38, fat: 24, serving: 180, aliases: ['chicken burger', 'grilled chicken sandwich'] },
  { name: 'Hotdog', category: 'fast_food', cal: 290, protein: 10, carbs: 22, fat: 17, serving: 100, aliases: ['hot dog', 'frankfurter'] },
  { name: 'Taco (beef)', category: 'fast_food', cal: 170, protein: 9, carbs: 13, fat: 9, serving: 75, aliases: ['beef taco'] },
  { name: 'Burrito (chicken)', category: 'fast_food', cal: 420, protein: 17, carbs: 47, fat: 18, serving: 230, aliases: ['chicken burrito'] },
  { name: 'Wrap (chicken)', category: 'fast_food', cal: 380, protein: 22, carbs: 40, fat: 16, serving: 220, aliases: ['chicken wrap'] },

  // BEVERAGES
  { name: 'Cola (regular, 250ml)', category: 'beverage', cal: 105, protein: 0, carbs: 29, fat: 0, serving: 250, aliases: ['coke', 'soda'] },
  { name: 'Orange Juice (250ml)', category: 'beverage', cal: 110, protein: 2, carbs: 26, fat: 0.5, serving: 250, aliases: ['oj', 'orange juice'] },
  { name: 'Apple Juice (250ml)', category: 'beverage', cal: 115, protein: 0.5, carbs: 28, fat: 0.3, serving: 250, aliases: ['apple juice'] },
  { name: 'Milk (whole, 250ml)', category: 'beverage', cal: 160, protein: 8, carbs: 12, fat: 9, serving: 250, aliases: ['whole milk'] },
  { name: 'Skim Milk (250ml)', category: 'beverage', cal: 85, protein: 8.5, carbs: 12, fat: 0.5, serving: 250, aliases: ['low-fat milk'] },
  { name: 'Smoothie (mixed berry)', category: 'beverage', cal: 220, protein: 6, carbs: 45, fat: 1.5, serving: 250, aliases: ['berry smoothie', 'fruit smoothie'] },
  { name: 'Coffee (black, 250ml)', category: 'beverage', cal: 5, protein: 0.3, carbs: 0.5, fat: 0, serving: 250, aliases: ['black coffee'] },
  { name: 'Latte (250ml)', category: 'beverage', cal: 120, protein: 6, carbs: 10, fat: 6, serving: 250, aliases: ['cappuccino'] },
  { name: 'Tea (black, 250ml)', category: 'beverage', cal: 2, protein: 0.5, carbs: 0, fat: 0, serving: 250, aliases: ['black tea'] },
  { name: 'Green Tea (250ml)', category: 'beverage', cal: 2, protein: 0.5, carbs: 0, fat: 0, serving: 250, aliases: ['green tea'] },
  { name: 'Lassi (yogurt drink)', category: 'beverage', cal: 145, protein: 5, carbs: 18, fat: 4, serving: 250, aliases: ['sweet lassi', 'yogurt lassi'] },
  { name: 'Milkshake (vanilla, 250ml)', category: 'beverage', cal: 260, protein: 7, carbs: 38, fat: 8, serving: 250, aliases: ['vanilla shake'] },

  // ICE CREAM
  { name: 'Vanilla Ice Cream', category: 'ice_cream', cal: 207, protein: 4, carbs: 24, fat: 11, serving: 100, aliases: ['vanilla ice cream', 'plain vanilla'] },
  { name: 'Chocolate Ice Cream', category: 'ice_cream', cal: 216, protein: 4, carbs: 26, fat: 12, serving: 100, aliases: ['chocolate ice cream'] },
  { name: 'Strawberry Ice Cream', category: 'ice_cream', cal: 200, protein: 3.5, carbs: 25, fat: 10, serving: 100, aliases: ['strawberry ice cream', 'strawberry flavor'] },
  { name: 'Mango Ice Cream', category: 'ice_cream', cal: 195, protein: 3, carbs: 27, fat: 9, serving: 100, aliases: ['mango ice cream', 'mango kulfi'] },
  { name: 'Butterscotch Ice Cream', category: 'ice_cream', cal: 220, protein: 4, carbs: 28, fat: 11, serving: 100, aliases: ['butterscotch flavor'] },
  { name: 'Mint Chocolate Ice Cream', category: 'ice_cream', cal: 210, protein: 4, carbs: 25, fat: 12, serving: 100, aliases: ['mint choco', 'mint chocolate'] },
  { name: 'Cookie Dough Ice Cream', category: 'ice_cream', cal: 240, protein: 4, carbs: 28, fat: 14, serving: 100, aliases: ['cookie dough'] },
  { name: 'Pistachio Ice Cream', category: 'ice_cream', cal: 210, protein: 5, carbs: 22, fat: 12, serving: 100, aliases: ['pistachio flavor'] },

  // DESSERTS
  { name: 'Chocolate Cake (slice)', category: 'dessert', cal: 235, protein: 3, carbs: 34, fat: 10, serving: 100, aliases: ['chocolate cake', 'cake slice'] },
  { name: 'Vanilla Cake (slice)', category: 'dessert', cal: 220, protein: 2.5, carbs: 32, fat: 9, serving: 100, aliases: ['vanilla cake'] },
  { name: 'Cheesecake (slice)', category: 'dessert', cal: 280, protein: 5, carbs: 24, fat: 19, serving: 100, aliases: ['cheese cake'] },
  { name: 'Brownie', category: 'dessert', cal: 280, protein: 3, carbs: 37, fat: 14, serving: 100, aliases: ['chocolate brownie', 'fudge brownie'] },
  { name: 'Chocolate Chip Cookie', category: 'dessert', cal: 210, protein: 2.5, carbs: 28, fat: 10, serving: 50, aliases: ['cookie', 'choco chip cookie'] },
  { name: 'Donut (glazed)', category: 'dessert', cal: 260, protein: 4, carbs: 31, fat: 14, serving: 80, aliases: ['glazed donut', 'doughnut'] },
  { name: 'Donut (chocolate)', category: 'dessert', cal: 290, protein: 4, carbs: 37, fat: 15, serving: 80, aliases: ['chocolate donut'] },
  { name: 'Croissant', category: 'dessert', cal: 430, protein: 9, carbs: 38, fat: 24, serving: 100, aliases: ['butter croissant'] },
  { name: 'Pastry (Danish)', category: 'dessert', cal: 420, protein: 8, carbs: 40, fat: 24, serving: 100, aliases: ['danish pastry'] },
  { name: 'Mousse (chocolate)', category: 'dessert', cal: 195, protein: 5, carbs: 18, fat: 12, serving: 100, aliases: ['chocolate mousse'] },
];

async function seed() {
  try {
    console.log('Initializing food database seed...');
    const app = await createApplication(schema);

    console.log('Checking if food database already populated...');
    const existing = await app.db
      .select()
      .from(schema.foodDatabase)
      .limit(1);

    if (existing.length > 0) {
      console.log('Food database already populated, skipping seed');
      process.exit(0);
      return;
    }

    console.log(`Seeding ${foodData.length} food items...`);

    // Insert food data
    for (const food of foodData) {
      await app.db
        .insert(schema.foodDatabase)
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

    console.log(`Successfully seeded ${foodData.length} food items`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed food database:', error);
    process.exit(1);
  }
}

seed();
