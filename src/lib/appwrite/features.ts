// Activate email signup/recovery only after the private username resolver is deployed.
export const emailAuthEnabled = Boolean(import.meta.env.VITE_APPWRITE_AUTH_FUNCTION_ID);
