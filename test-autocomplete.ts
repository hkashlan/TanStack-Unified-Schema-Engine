// Test file to verify appClient.models.todo autocompletes
import { appClient } from "@tanstack-use/core";

// After the module augmentation in router.tsx, this should autocomplete:
const _todoModel = appClient.models.todo;
