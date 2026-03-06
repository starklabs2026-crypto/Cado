import { describe, test, expect } from "bun:test";
import {
  api,
  authenticatedApi,
  signUpTestUser,
  expectStatus,
  createTestFile,
} from "./helpers";

describe("API Integration Tests", () => {
  let authToken: string;
  let foodEntryId: string;
  let foodEntryIdForOwnershipTest: string;
  let userId: string;
  let token2: string;
  let user2Id: string;
  let groupId: string;
  let groupIdForRejection: string;
  let groupIdForInviteLink: string;
  let invitationId: string;
  let invitationIdForRejection: string;
  let notificationId: string;
  let inviteToken: string;

  test("Sign up test user", async () => {
    const { token, user } = await signUpTestUser();
    authToken = token;
    userId = user.id;
    expect(authToken).toBeDefined();
  });

  // ===== User Profile Tests =====

  test("Get user profile", async () => {
    const res = await authenticatedApi("/api/user/profile", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.userId).toBeDefined();
    expect(typeof data.onboarding_completed).toBe("boolean");
    expect(typeof data.is_pro).toBe("boolean");
  });

  test("Update user profile", async () => {
    const res = await authenticatedApi("/api/user/profile", authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        age: 30,
        gender: "M",
        height_cm: 180,
        weight_kg: 75,
        goal: "lose weight",
        activity_level: "moderate",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.userId).toBeDefined();
    expect(data.age).toBe(30);
  });

  test("Get user profile without auth returns 401", async () => {
    const res = await api("/api/user/profile");
    await expectStatus(res, 401);
  });

  test("Update user profile without auth returns 401", async () => {
    const res = await api("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ age: 25 }),
    });
    await expectStatus(res, 401);
  });

  // ===== Onboarding Tests =====

  test("Complete onboarding", async () => {
    const res = await authenticatedApi(
      "/api/user/complete-onboarding",
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age: 25,
          gender: "F",
          height_cm: 165,
          weight_kg: 65,
          goal: "gain muscle",
          activity_level: "high",
        }),
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.userId).toBeDefined();
    expect(data.onboarding_completed).toBe(true);
    expect(typeof data.daily_calorie_target).toBe("number");
  });

  test("Complete onboarding without required fields returns 400", async () => {
    const res = await authenticatedApi(
      "/api/user/complete-onboarding",
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age: 25,
          gender: "F",
          // missing height_cm, weight_kg, goal, activity_level
        }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Complete onboarding without auth returns 401", async () => {
    const res = await api("/api/user/complete-onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        age: 25,
        gender: "F",
        height_cm: 165,
        weight_kg: 65,
        goal: "gain muscle",
        activity_level: "high",
      }),
    });
    await expectStatus(res, 401);
  });

  // ===== Usage Tests =====

  test("Get usage today", async () => {
    const res = await authenticatedApi("/api/usage/today", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.date).toBeDefined();
    expect(typeof data.scans_count).toBe("number");
    expect(typeof data.scans_remaining).toBe("number");
    expect(typeof data.is_pro).toBe("boolean");
    expect(typeof data.can_scan).toBe("boolean");
  });

  test("Check scan limit", async () => {
    const res = await authenticatedApi("/api/usage/check-limit", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(typeof data.can_scan).toBe("boolean");
  });

  test("Increment usage", async () => {
    const res = await authenticatedApi("/api/usage/increment", authToken, {
      method: "POST",
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(typeof data.scans_count).toBe("number");
    expect(typeof data.scans_remaining).toBe("number");
    expect(typeof data.can_scan).toBe("boolean");
  });

  test("Get usage today without auth returns 401", async () => {
    const res = await api("/api/usage/today");
    await expectStatus(res, 401);
  });

  test("Check scan limit without auth returns 401", async () => {
    const res = await api("/api/usage/check-limit");
    await expectStatus(res, 401);
  });

  test("Increment usage without auth returns 401", async () => {
    const res = await api("/api/usage/increment", {
      method: "POST",
    });
    await expectStatus(res, 401);
  });

  // ===== Food Entries CRUD Tests =====

  test("Create food entry", async () => {
    const res = await authenticatedApi("/api/food-entries", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        foodName: "Chicken Breast",
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        mealType: "lunch",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    foodEntryId = data.id;
    expect(data.foodName).toBe("Chicken Breast");
    expect(data.calories).toBe(165);
  });

  test("Create additional food entry for history tests", async () => {
    const res = await authenticatedApi("/api/food-entries", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        foodName: "Broccoli",
        calories: 55,
        protein: 3.7,
        carbs: 11,
        fat: 0.6,
        mealType: "dinner",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    foodEntryIdForOwnershipTest = data.id;
  });

  test("Get all food entries", async () => {
    const res = await authenticatedApi("/api/food-entries", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(2);
  });

  test("Get today's food entries", async () => {
    const res = await authenticatedApi("/api/food-entries/today", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Get today's food stats", async () => {
    const res = await authenticatedApi(
      "/api/food-entries/stats/today",
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(typeof data.totalCalories).toBe("number");
    expect(typeof data.totalProtein).toBe("number");
    expect(typeof data.totalCarbs).toBe("number");
    expect(typeof data.totalFat).toBe("number");
    expect(typeof data.entryCount).toBe("number");
  });

  // ===== History and Date Stats Tests =====

  test("Get food entries history", async () => {
    const res = await authenticatedApi("/api/food-entries/history", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      expect(data[0].date).toBeDefined();
      expect(Array.isArray(data[0].entries)).toBe(true);
      expect(data[0].stats).toBeDefined();
    }
  });

  test("Get food entries history with days parameter", async () => {
    const res = await authenticatedApi(
      "/api/food-entries/history?days=7",
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Get stats for specific date", async () => {
    const res = await authenticatedApi(
      "/api/food-entries/stats/date/2026-03-06",
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(typeof data.totalCalories).toBe("number");
    expect(typeof data.totalProtein).toBe("number");
    expect(typeof data.totalCarbs).toBe("number");
    expect(typeof data.totalFat).toBe("number");
    expect(typeof data.entryCount).toBe("number");
  });

  test("Get stats for invalid date format returns 400", async () => {
    const res = await authenticatedApi(
      "/api/food-entries/stats/date/invalid-date",
      authToken
    );
    await expectStatus(res, 400);
  });

  test("Get history without auth returns 401", async () => {
    const res = await api("/api/food-entries/history");
    await expectStatus(res, 401);
  });

  test("Get date stats without auth returns 401", async () => {
    const res = await api("/api/food-entries/stats/date/2026-03-06");
    await expectStatus(res, 401);
  });

  // ===== Food Entry Update/Delete Tests =====

  test("Update food entry", async () => {
    const res = await authenticatedApi(
      `/api/food-entries/${foodEntryId}`,
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodName: "Grilled Chicken Breast",
          calories: 170,
        }),
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.foodName).toBe("Grilled Chicken Breast");
  });

  test("Delete food entry", async () => {
    const res = await authenticatedApi(
      `/api/food-entries/${foodEntryId}`,
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test("Delete non-existent food entry returns 404", async () => {
    const res = await authenticatedApi(
      "/api/food-entries/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  test("Update non-existent food entry returns 404", async () => {
    const res = await authenticatedApi(
      "/api/food-entries/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodName: "Updated Food",
        }),
      }
    );
    await expectStatus(res, 404);
  });

  // ===== Food Entry Ownership Tests (403) =====

  test("Update food entry from another user returns 403", async () => {
    const { token: otherUserToken } = await signUpTestUser();
    const res = await authenticatedApi(
      `/api/food-entries/${foodEntryIdForOwnershipTest}`,
      otherUserToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodName: "Hacked by another user",
          calories: 999,
        }),
      }
    );
    await expectStatus(res, 403);
  });

  test("Delete food entry from another user returns 403", async () => {
    const { token: otherUserToken } = await signUpTestUser();
    const res = await authenticatedApi(
      `/api/food-entries/${foodEntryIdForOwnershipTest}`,
      otherUserToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 403);
  });

  // ===== Food Entry Auth Error Tests =====

  test("Create food entry without auth returns 401", async () => {
    const res = await api("/api/food-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        foodName: "Test Food",
        calories: 100,
      }),
    });
    await expectStatus(res, 401);
  });

  test("Get all food entries without auth returns 401", async () => {
    const res = await api("/api/food-entries");
    await expectStatus(res, 401);
  });

  test("Get today's food entries without auth returns 401", async () => {
    const res = await api("/api/food-entries/today");
    await expectStatus(res, 401);
  });

  test("Get today's stats without auth returns 401", async () => {
    const res = await api("/api/food-entries/stats/today");
    await expectStatus(res, 401);
  });

  // ===== Food Entry Validation Tests =====

  test("Create food entry without required fields returns 400", async () => {
    const res = await authenticatedApi("/api/food-entries", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        foodName: "Test Food",
        // missing calories
      }),
    });
    await expectStatus(res, 400);
  });

  // ===== Food Image Analysis Tests =====

  test("Analyze food image", async () => {
    const form = new FormData();
    // Use a minimal but valid PNG (8x8 pixels with food-like orange color)
    // This is small enough to encode but large enough for Gemini to analyze
    const pngBuffer = Buffer.from([
      // PNG signature
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      // IHDR chunk (8x8 RGB)
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x08,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x4b, 0x6d, 0x25,
      0xdc,
      // IDAT chunk (orange pixels)
      0x00, 0x00, 0x00, 0x1b, 0x49, 0x44, 0x41, 0x54,
      0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00,
      0x0d, 0x00, 0x08, 0xff, 0xff, 0x01, 0x00, 0x02,
      0x00, 0x01, 0x00, 0x08, 0x17, 0x4e, 0x8f, 0xf3,
      0x1c, 0xef,
      // IEND chunk
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
      0xae, 0x42, 0x60, 0x82,
    ]);
    const pngFile = new File([pngBuffer], "test-food.png", { type: "image/png" });
    form.append("file", pngFile);
    const res = await authenticatedApi("/api/food/analyze-image", authToken, {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.foodName).toBeDefined();
    expect(typeof data.calories).toBe("number");
    expect(["high", "medium", "low"]).toContain(data.confidence);
  });

  test("Analyze food image without auth returns 401", async () => {
    const form = new FormData();
    form.append("file", createTestFile("test-food.jpg", "", "image/jpeg"));
    const res = await api("/api/food/analyze-image", {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 401);
  });

  test("Analyze food image without file returns 400", async () => {
    const form = new FormData();
    const res = await authenticatedApi("/api/food/analyze-image", authToken, {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 400);
  });

  // ===== Food Entry from Image Tests =====

  test("Create food entry from image", async () => {
    const res = await authenticatedApi(
      "/api/food-entries/from-image",
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodName: "Pasta Carbonara",
          calories: 450,
          protein: 18,
          carbs: 55,
          fat: 20,
          imageUrl: "https://example.com/pasta.jpg",
          mealType: "dinner",
        }),
      }
    );
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.userId).toBeDefined();
    expect(data.foodName).toBe("Pasta Carbonara");
    expect(data.calories).toBe(450);
    expect(data.recognizedByAi).toBeDefined();
  });

  test("Create food entry from image without required fields returns 400", async () => {
    const res = await authenticatedApi(
      "/api/food-entries/from-image",
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodName: "Pasta",
          // missing calories
        }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Create food entry from image without auth returns 401", async () => {
    const res = await api("/api/food-entries/from-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        foodName: "Pasta Carbonara",
        calories: 450,
        imageUrl: "https://example.com/pasta.jpg",
      }),
    });
    await expectStatus(res, 401);
  });

  // ===== Groups Tests =====

  test("Sign up second test user for group tests", async () => {
    const { token, user } = await signUpTestUser();
    token2 = token;
    user2Id = user.id;
    expect(token2).toBeDefined();
  });

  test("Create private group", async () => {
    const res = await authenticatedApi("/api/groups/create-private", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Private Group",
        description: "A test group for integration testing",
        invitedUserIds: [user2Id],
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    groupId = data.groupId;
    expect(data.groupId).toBeDefined();
    expect(data.invitationsSent).toBe(1);
  });

  test("Create second group for rejection test", async () => {
    const res = await authenticatedApi("/api/groups/create-private", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Group for Rejection Test",
        description: "Testing invitation rejection",
        invitedUserIds: [user2Id],
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    groupIdForRejection = data.groupId;
    expect(data.groupId).toBeDefined();
  });

  test("Create third group for invite link test", async () => {
    const res = await authenticatedApi("/api/groups/create-private", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Group for Invite Link Test",
        description: "Testing invite link generation",
        invitedUserIds: [],
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    groupIdForInviteLink = data.groupId;
    expect(data.groupId).toBeDefined();
  });

  test("Get all groups", async () => {
    const res = await authenticatedApi("/api/groups", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.myGroups).toBeDefined();
    expect(Array.isArray(data.myGroups)).toBe(true);
    expect(data.discoverGroups).toBeDefined();
    expect(Array.isArray(data.discoverGroups)).toBe(true);
    expect(data.myGroups.length).toBeGreaterThanOrEqual(3);
  });

  test("Get all groups for second user", async () => {
    const res = await authenticatedApi("/api/groups", token2);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.myGroups).toBeDefined();
    expect(Array.isArray(data.myGroups)).toBe(true);
    expect(data.discoverGroups).toBeDefined();
    expect(Array.isArray(data.discoverGroups)).toBe(true);
  });

  test("Get group details by ID", async () => {
    const res = await authenticatedApi(`/api/groups/${groupId}`, authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(groupId);
    expect(data.name).toBe("Test Private Group");
    expect(Array.isArray(data.members)).toBe(true);
  });

  test("Get non-existent group returns 404", async () => {
    const res = await authenticatedApi(
      "/api/groups/00000000-0000-0000-0000-000000000000",
      authToken
    );
    await expectStatus(res, 404);
  });

  test("Get invalid UUID group returns 400 or 404", async () => {
    const res = await authenticatedApi(
      "/api/groups/invalid-uuid",
      authToken
    );
    await expectStatus(res, 400, 404);
  });

  test("Get groups without auth returns 401", async () => {
    const res = await api("/api/groups");
    await expectStatus(res, 401);
  });

  test("Get group details without auth returns 401", async () => {
    const res = await api(`/api/groups/${groupId}`);
    await expectStatus(res, 401);
  });

  test("Create group without auth returns 401", async () => {
    const res = await api("/api/groups/create-private", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Unauthorized Group",
        invitedUserIds: [user2Id],
      }),
    });
    await expectStatus(res, 401);
  });

  test("Create group with missing required fields returns 400", async () => {
    const res = await authenticatedApi("/api/groups/create-private", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Missing Invites",
        // missing invitedUserIds
      }),
    });
    await expectStatus(res, 400);
  });

  // ===== Group Invite Link Tests =====

  test("Generate invite link for group", async () => {
    const res = await authenticatedApi(
      `/api/groups/${groupIdForInviteLink}/generate-invite-link`,
      authToken,
      {
        method: "POST",
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.inviteLink).toBeDefined();
    expect(data.inviteToken).toBeDefined();
    inviteToken = data.inviteToken;
  });

  test("Generate invite link for non-existent group returns 404", async () => {
    const res = await authenticatedApi(
      "/api/groups/00000000-0000-0000-0000-000000000000/generate-invite-link",
      authToken,
      {
        method: "POST",
      }
    );
    await expectStatus(res, 404);
  });

  test("Generate invite link without auth returns 401", async () => {
    const res = await api(
      `/api/groups/${groupIdForInviteLink}/generate-invite-link`,
      {
        method: "POST",
      }
    );
    await expectStatus(res, 401);
  });

  test("Join group by invite token", async () => {
    const res = await authenticatedApi(
      "/api/groups/join-by-invite",
      token2,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteToken: inviteToken,
        }),
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.groupId).toBeDefined();
    expect(data.groupName).toBeDefined();
  });

  test("Join group by invalid token returns 403 or 404", async () => {
    const res = await authenticatedApi(
      "/api/groups/join-by-invite",
      token2,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteToken: "invalid-token-xyz",
        }),
      }
    );
    await expectStatus(res, 403, 404);
  });

  test("Join group by invite token without auth returns 401", async () => {
    const res = await api(
      "/api/groups/join-by-invite",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteToken: inviteToken,
        }),
      }
    );
    await expectStatus(res, 401);
  });

  // ===== Group Messages Tests =====

  test("Send message to group", async () => {
    const res = await authenticatedApi(
      `/api/groups/${groupId}/messages`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "Hello, group!",
        }),
      }
    );
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.content).toBe("Hello, group!");
    expect(data.userId).toBeDefined();
    expect(data.userName).toBeDefined();
    expect(data.createdAt).toBeDefined();
  });

  test("Send message to non-existent group returns 404", async () => {
    const res = await authenticatedApi(
      "/api/groups/00000000-0000-0000-0000-000000000000/messages",
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "This will fail",
        }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Send message without required content returns 400", async () => {
    const res = await authenticatedApi(
      `/api/groups/${groupId}/messages`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );
    await expectStatus(res, 400);
  });

  test("Send message to group without auth returns 401", async () => {
    const res = await api(`/api/groups/${groupId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Unauthorized",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Get group messages", async () => {
    const res = await authenticatedApi(
      `/api/groups/${groupId}/messages`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      expect(data[0].id).toBeDefined();
      expect(data[0].content).toBeDefined();
      expect(data[0].userId).toBeDefined();
      expect(data[0].userName).toBeDefined();
      expect(data[0].createdAt).toBeDefined();
    }
  });

  test("Get messages from non-existent group returns 404", async () => {
    const res = await authenticatedApi(
      "/api/groups/00000000-0000-0000-0000-000000000000/messages",
      authToken
    );
    await expectStatus(res, 404);
  });

  test("Get group messages without auth returns 401", async () => {
    const res = await api(`/api/groups/${groupId}/messages`);
    await expectStatus(res, 401);
  });

  // ===== Group Invitations Tests =====

  test("Get pending group invitations", async () => {
    const res = await authenticatedApi(
      "/api/group-invitations/pending",
      token2
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    // Second user should have invitations from the groups created above
    if (data.length > 0) {
      // Find the first invitation for acceptance test
      const invitation = data.find(inv => inv.groupId === groupId);
      if (invitation) {
        invitationId = invitation.id;
      }
      // Find the invitation from the second group (for rejection test)
      const rejectionInvitation = data.find(inv => inv.groupId === groupIdForRejection);
      if (rejectionInvitation) {
        invitationIdForRejection = rejectionInvitation.id;
      }
    }
  });

  test("Accept group invitation", async () => {
    if (invitationId) {
      const res = await authenticatedApi(
        `/api/group-invitations/${invitationId}/accept`,
        token2,
        {
          method: "POST",
        }
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.groupId).toBeDefined();
    }
  });

  test("Reject group invitation", async () => {
    if (invitationIdForRejection) {
      const res = await authenticatedApi(
        `/api/group-invitations/${invitationIdForRejection}/reject`,
        token2,
        {
          method: "POST",
        }
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
    }
  });

  test("Reject non-existent invitation returns 404", async () => {
    const res = await authenticatedApi(
      "/api/group-invitations/00000000-0000-0000-0000-000000000000/reject",
      token2,
      {
        method: "POST",
      }
    );
    await expectStatus(res, 404);
  });

  test("Accept non-existent invitation returns 404", async () => {
    const res = await authenticatedApi(
      "/api/group-invitations/00000000-0000-0000-0000-000000000000/accept",
      token2,
      {
        method: "POST",
      }
    );
    await expectStatus(res, 404);
  });

  test("Get pending invitations without auth returns 401", async () => {
    const res = await api("/api/group-invitations/pending");
    await expectStatus(res, 401);
  });

  test("Accept invitation without auth returns 401", async () => {
    const res = await api(
      `/api/group-invitations/${invitationId}/accept`,
      {
        method: "POST",
      }
    );
    await expectStatus(res, 401);
  });

  test("Reject invitation without auth returns 401", async () => {
    const res = await api(
      `/api/group-invitations/${invitationId}/reject`,
      {
        method: "POST",
      }
    );
    await expectStatus(res, 401);
  });

  // ===== Notifications Tests =====

  test("Get all notifications", async () => {
    const res = await authenticatedApi("/api/notifications", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      notificationId = data[0].id;
      expect(data[0].id).toBeDefined();
      expect(data[0].type).toBeDefined();
      expect(typeof data[0].read).toBe("boolean");
    }
  });

  test("Get unread notification count", async () => {
    const res = await authenticatedApi(
      "/api/notifications/unread-count",
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(typeof data.count).toBe("number");
  });

  test("Mark notification as read", async () => {
    if (notificationId) {
      const res = await authenticatedApi(
        `/api/notifications/${notificationId}/mark-read`,
        authToken,
        {
          method: "POST",
        }
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
    }
  });

  test("Mark non-existent notification as read returns 404", async () => {
    const res = await authenticatedApi(
      "/api/notifications/00000000-0000-0000-0000-000000000000/mark-read",
      authToken,
      {
        method: "POST",
      }
    );
    await expectStatus(res, 404);
  });

  test("Get notifications without auth returns 401", async () => {
    const res = await api("/api/notifications");
    await expectStatus(res, 401);
  });

  test("Get unread count without auth returns 401", async () => {
    const res = await api("/api/notifications/unread-count");
    await expectStatus(res, 401);
  });

  test("Mark notification as read without auth returns 401", async () => {
    const res = await api(
      "/api/notifications/00000000-0000-0000-0000-000000000000/mark-read",
      {
        method: "POST",
      }
    );
    await expectStatus(res, 401);
  });

  // ===== Group Join Tests =====

  test("Join public group", async () => {
    // Try to join the group we already created (may be private or public)
    const res = await authenticatedApi(
      `/api/groups/${groupId}/join`,
      token2,
      {
        method: "POST",
      }
    );
    // Should succeed if group is public and user isn't already a member, or return 403/409 if private/already member
    await expectStatus(res, 200, 403, 409);
  });

  test("Join non-existent group returns 404", async () => {
    const res = await authenticatedApi(
      "/api/groups/00000000-0000-0000-0000-000000000000/join",
      authToken,
      {
        method: "POST",
      }
    );
    await expectStatus(res, 404);
  });

  test("Join group without auth returns 401", async () => {
    const res = await api(`/api/groups/${groupId}/join`, {
      method: "POST",
    });
    await expectStatus(res, 401);
  });
});
