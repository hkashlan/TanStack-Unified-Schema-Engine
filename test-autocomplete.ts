// Test file to verify appClient.models.todo autocompletes
import { appClient } from "@tanstack-use/core";

// After the module augmentation in router.tsx, this should autocomplete:
const todoModel = appClient.models.todo;

// This should error (post doesn't exist):
// const postModel = appClient.models.post;

export {};
