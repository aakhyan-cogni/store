import { Server } from "#lib";

new Server().start();
// import { createServer } from "http";

// const server = createServer((req, res) => {
// 	const { method, url } = req;

// 	if (method === "GET" && url === "/") {
// 		res.writeHead(200, { "content-type": "application/json" });
// 		res.end(
// 			JSON.stringify({
// 				message: "Server is running",
// 			}),
// 		);
// 		return;
// 	}
// });

// server.listen(process.env.PORT, () => {
// 	console.log(`Server is running on http://localhost:${process.env.PORT}`);
// });
