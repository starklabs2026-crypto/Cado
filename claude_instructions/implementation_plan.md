# RevenueCat & User Access Plan

The goal is to integrate RevenueCat for premium subscriptions and enforce a
7-day limit for guest users.

## Subscription Details

- **Trial**: 5-day free trial baked into the offering.
- **Monthly**: $3.99/month.
- **Yearly**: $29/year.

## Guest User Logic

- Guests are permitted to use the app for **7 days** from the date of account
  creation.
- After 7 days, the app must force a logout and prompt for registration.

## Proposed Changes

### [Component] Backend - RevenueCat & Guest Session Enforcement

#### [NEW] [revenuecat.ts](file:///f:/Projects/Intern%20Assignments/CountryBean/i-want-to-build-a-ca-inncqm/backend/src/routes/revenuecat.ts)

- `POST /api/webhooks/revenuecat`: Receives platform-agnostic webhooks.
- Logic: On `INITIAL_PURCHASE` or `RENEWAL`, find user by App User ID and update
  `isPro: true` and `proExpiresAt`.

#### [MODIFY] [auth.ts](file:///f:/Projects/Intern%20Assignments/CountryBean/i-want-to-build-a-ca-inncqm/backend/src/routes/auth.ts)

- Add middleware or logic to check `guest_users.createdAt`. Returns a specific
  error code (e.g., `GUEST_SESSION_EXPIRED`) if > 7 days.

### [Component] Frontend - Purchases & Auth Guard

#### [MODIFY] [app/\_layout.tsx](file:///f:/Projects/Intern%20Assignments/CountryBean/i-want-to-build-a-ca-inncqm/app/_layout.tsx)

- Initialize `Purchases` with API Keys (placeholders for now).
- Add a global listener for auth state; if a guest's token is older than 7 days
  (or backend returns expiry error), redirect to `/auth`.

#### [NEW] [subscribe.tsx](file:///f:/Projects/Intern%20Assignments/CountryBean/i-want-to-build-a-ca-inncqm/app/subscribe.tsx)

- Premium UI displaying the $3.99/mo and $29/yr tiers.
- Explicitly mention the 5-day free trial on the "Start Trial" button.
