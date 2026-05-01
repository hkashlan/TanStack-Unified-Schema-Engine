import { defineAuth } from "@tanstack-use/permissions";
import { db } from "#/lib/db";

export const auth = defineAuth({
  database: db,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [],
});
