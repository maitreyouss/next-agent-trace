import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@langchain/core",
    "@langchain/langgraph",
    "@langchain/openai",
  ],
};

export default nextConfig;
