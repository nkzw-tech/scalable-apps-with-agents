import remdx from "@nkzw/vite-plugin-remdx";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { voidPlugin } from "void";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  plugins: [voidPlugin(), remdx(), react()],
});
