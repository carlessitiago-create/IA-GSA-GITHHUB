require("ts-node").register();
try {
  require("./functions/index.ts");
  console.log("SUCCESS");
} catch (e) {
  console.error("RUNTIME ERROR:", e);
}
