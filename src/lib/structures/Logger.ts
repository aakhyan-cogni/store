import winston, { format } from "winston";
import { cyan, dim, gray, magenta, red, yellow } from "colorette";
import { LogLevel } from "#src/types";

const LEVEL_COLORS: Record<LogLevel, (text: string) => string> = {
	[LogLevel.Error]: red,
	[LogLevel.Warn]: yellow,
	[LogLevel.Info]: cyan,
	[LogLevel.Http]: magenta,
	[LogLevel.Verbose]: gray,
	[LogLevel.Debug]: gray,
	[LogLevel.Silly]: gray,
};

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
						this.customFormat(),
					),
				}),
			);
		}
		return logger;
	}

	private static customFormat() {
		return format.printf(({ level, message, timestamp }) => {
			const colorize = LEVEL_COLORS[level as LogLevel] ?? ((text: string) => text);
			return `${dim(timestamp as string)} [${colorize(level.toUpperCase())}]: ${message}`;
		});
	}
}
