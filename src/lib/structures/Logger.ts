import winston, { format } from "winston";
import { LogLevel } from "#src/types";

export class Logger {
	public static init() {
		const logger = winston.createLogger({
			level: LogLevel.Info,
			format: format.combine(format.timestamp(), format.json()),
			transports: [
				new winston.transports.File({
					filename: "error.log",
					dirname: "logs",
					level: LogLevel.Error,
				}),
				new winston.transports.File({
					filename: "logs.log",
					dirname: "logs",
				}),
			],
		});

		if (process.env.NODE_ENV !== "production") {
			logger.add(
				new winston.transports.Console({
					format: format.combine(
						format.timestamp({
							format: "HH:mm:ss.SSS",
						}),
						format.colorize(),
						this.customFormat(),
					),
				}),
			);
		}
		return logger;
	}

	private static customFormat() {
		return format.printf(({ level, message, timestamp }) => {
			return `${timestamp} [${level}]: ${message}`;
		});
	}
}
