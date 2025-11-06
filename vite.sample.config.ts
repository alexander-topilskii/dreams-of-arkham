import { defineConfig } from "vite";

export default defineConfig({
    root: "samples/1",             // точка входа семпла
    build: {
        outDir: "../../dist-sample", // сборка семпла
        emptyOutDir: true,
    },
    server: { open: true },
});
