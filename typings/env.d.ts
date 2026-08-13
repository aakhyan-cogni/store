declare namespace NodeJS {
	interface ProcessEnv {
		PORT: string;
		NODE_ENV: "production" | "development" | "testing";
	}
}
