// High-speed static server for Markie preview using native Bun
const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file("./src" + pathname);
    return new Response(file);
  },
});

console.log(`Markie live preview running at http://localhost:${server.port}`);
