const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on("error", (err) => {
  console.log("🔥 ERROR:", err.message);
});
virtualConsole.on("jsdomError", (err) => {
  console.log("🔥 JSDOM ERROR:", err.message);
});

console.log("Launching JSDOM...");

const dom = new JSDOM(html, {
  url: "https://dot-system.vercel.app/",
  runScripts: "dangerously",
  resources: "usable",
  virtualConsole
});

dom.window.addEventListener('error', (e) => {
    console.log("Global Error:", e.message);
});

setTimeout(() => {
    console.log("DOM Loaded.");
    process.exit(0);
}, 3000);
