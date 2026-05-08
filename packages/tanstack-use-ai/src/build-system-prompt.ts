// import type { App } from "@tanstack-use/core";

// /**
//  * Generates a natural-language system prompt describing all registered models,
//  * their fields, and their available pages/operations.
//  *
//  * The returned string is suitable for use as the AI system message when
//  * initialising a TanStack AI chat session.
//  *
//  * Requirements: 13.3
//  */
// export function buildSystemPrompt(app: App): string {
//   const lines: string[] = [
//     "You are an AI assistant for this application. You have access to the following data:",
//   ];

//   for (const [tableName, model] of app.models) {
//     // Drizzle stores column definitions under Symbol.for("drizzle:Columns") at runtime.
//     // The `_` property is TypeScript-only and not present at runtime.
//     const columns = (model.table as unknown as Record<symbol, Record<string, unknown>>)[
//       Symbol.for("drizzle:Columns")
//     ] ?? {};
//     const fieldNames = Object.keys(columns).join(", ");

//     lines.push(`- ${tableName}: fields [${fieldNames}]`);

//     const layout = model.ui.layout;

//     if (!layout || (!layout.list && !layout.detail && !layout.create)) {
//       lines.push(`  • No pages available for ${tableName}`);
//     } else {
//       if (layout.list) {
//         lines.push(`  • Can list ${tableName}`);
//       }
//       if (layout.detail) {
//         lines.push(`  • Can view ${tableName} details`);
//       }
//       if (layout.create) {
//         lines.push(`  • Can create ${tableName}`);
//       }
//     }
//   }

//   return lines.join("\n");
// }
