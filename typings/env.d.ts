declare namespace NodeJS {
	interface ProcessEnv {
		PORT: string;
		NODE_ENV: "production" | "development" | "testing";
		DATABASE_URL: string;

		JWT_SECRET: string;
		JWT_EXPIRES_IN: string;
	}
}
