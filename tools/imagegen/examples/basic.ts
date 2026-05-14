import { generateImages } from "../src/index.js";

await generateImages({
  items: [
    { id: "apple", prompt: "a single red apple on a white seamless background, studio photo, soft shadow" },
    { id: "pear",  prompt: "a single green pear on a white seamless background, studio photo, soft shadow" },
  ],
  model: "flux-1.1-pro",
  outDir: "./out",
  format: "webp",
  size: 512,
  concurrency: 2,
  onProgress: (e) => console.log(e),
});
