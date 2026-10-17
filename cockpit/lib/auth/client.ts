"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, twoFactorClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    // Zum zweiten Faktor leitet die Anmeldung selbst weiter (LoginForm) – samt Rücksprungadresse.
    // Eine eigene Weiterleitung hier lief ihr früher davon und verlor sie.
    twoFactorClient(),
    passkeyClient(),
  ],
});
