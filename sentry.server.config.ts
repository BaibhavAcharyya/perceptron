// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://f9637b8097a35e7cc3ebad4e7f4e217a@o4510907027816448.ingest.de.sentry.io/4510907074216016",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
  integrations: [Sentry.vercelAIIntegration,
      Sentry.consoleLoggingIntegration({
      levels: ["log", "warn", "error"]}),
  ],
});
