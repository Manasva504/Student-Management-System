# Design Patterns Used

## Singleton — config/db.js
An isConnected flag guards connectDB() against opening a second MongoDB connection if called more than once. Guarantees exactly one shared connection for the app's lifetime.

## Factory — utils/tokenFactory.js
createAuthToken(user) centralizes JWT creation in one place. Any part of the app needing a token calls this function instead of duplicating jwt.sign(...) details (secret, algorithm, payload shape).

## Strategy — utils/notificationStrategies.js
getNotificationStrategy(type) picks which notification implementation to use at runtime. Callers (e.g. forgot-password) always call the same interface regardless of which concrete sender they get back.

## Observer — events/authEvents.js + listeners/authListeners.js
Login emits a "userLoggedIn" event instead of directly writing an audit log. A separate listener reacts to it. Decouples "what happened" from "what should happen as a result," so new reactions can be added without touching the login route.

## Adapter — utils/sendEmail.js (Resend) and utils/sendNotificationEmail.js (Nodemailer/Gmail)
Two different email providers, each wrapped behind the identical (to, subject, text) interface. Callers never know or care which provider is underneath — this uniformity is what made Strategy Pattern possible on top of them.

## Dependency Injection — repositories/BaseRepository.js + services/BaseService.js
Generic CRUD/business-logic classes that receive their Model/Repository via constructor injection rather than hardcoding it. UserRepository/UserService extend these bases, so common logic is written once and reused, and dependencies can be swapped (e.g., for testing) without changing the base classes.

## DRY / Clean Code — utils/responseHandler.js, utils/constants.js, utils/validators.js
Extracted repeated response-shaping, hardcoded strings, and field-validation logic out of authRoutes.js into shared modules, removing duplication across routes.
