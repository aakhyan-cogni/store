declare namespace NodeJS {
	interface ProcessEnv {
		PORT: string;
		NODE_ENV: "production" | "development" | "testing" | "test";
		DATABASE_URL: string;

		JWT_SECRET: string;
		JWT_EXPIRES_IN: string;
	}
}
