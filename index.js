import figlet from "figlet"
import { getMem, getCPU } from "./info.js";
import Bun from "bun"


const server = Bun.serve({
  host: "0.0.0.0",
  port: 3000,
  async fetch(req) {
    console.log(`Got a ${req.method} request on ${req.url}`);
    const url = new URL(req.url);
    if (url.pathname === "/memory") {
        const data = await getMem();
        return new Response(JSON.stringify(data));
    }
    else if (url.pathname === "/cpu") {
        const data = await getCPU();
        return new Response(JSON.stringify(data));
    }
    const body = figlet.textSync("Bringin' you the Bun Info!");
    return new Response(body);
  },
});


console.log(`Info server listening on http://localhost:${server.port} ...`);
