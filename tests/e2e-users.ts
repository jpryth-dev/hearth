export const E2E_ADMIN = { email: "admin@e2e.test", name: "E2E Admin" } as const;

/** Members created directly in the test database by e2e setup. */
export const E2E_MEMBERS = {
  alice: { email: "alice@e2e.test", name: "Alice" },
  bob: { email: "bob@e2e.test", name: "Bob" },
  carol: { email: "carol@e2e.test", name: "Carol" },
} as const;
