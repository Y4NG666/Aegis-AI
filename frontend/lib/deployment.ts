"use client";

import localhostDeployment from "../../deployments/localhost.json";
import sepoliaDeployment from "../../deployments/sepolia.json";

type DeploymentManifest = typeof sepoliaDeployment;

const DEFAULT_NETWORK =
  (process.env.NEXT_PUBLIC_DEPLOYMENT_NETWORK ?? "sepolia").toLowerCase();

export const deployment: DeploymentManifest =
  DEFAULT_NETWORK === "localhost" ? localhostDeployment : sepoliaDeployment;

export const DEFAULT_RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ??
  (DEFAULT_NETWORK === "localhost"
    ? "http://127.0.0.1:8545"
    : "https://ethereum-sepolia-rpc.publicnode.com");

export const DEFAULT_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID ?? deployment.chainId ?? 11155111,
);

export const DEFAULT_CHAIN_NAME =
  process.env.NEXT_PUBLIC_CHAIN_NAME ??
  (DEFAULT_NETWORK === "localhost" ? "Hardhat Localhost" : "Sepolia");
