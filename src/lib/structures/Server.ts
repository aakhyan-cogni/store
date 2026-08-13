import { Logger } from "./Logger.js";
import { Server as NodeServer } from "http";

export class Server extends NodeServer {
	public readonly logger = Logger.init();
	public constructor() {
		super();
		this.logger.info("Initiated Server...");
	}

	public initiateRegistry() {
		this.on("request", (req, res) => {
			res.writeHead(200, { "content-type": "application/json" });
			res.end(
				JSON.stringify({
					message: "Everything is working just fine",
				}),
			);
		});
	}

	public start() {
		this.initiateRegistry();
		this.listen(process.env.PORT, () => {
			this.logger.info(`Server has started, listening on http://localhost:${process.env.PORT}`);
		});
	}
}
