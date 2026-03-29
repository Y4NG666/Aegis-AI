"use client";

import {
  Contract,
  JsonRpcProvider,
  type ContractRunner,
  type InterfaceAbi,
} from "ethers";

import guardianArtifact from "../../artifacts/contracts/AegisAIGuardian.sol/AegisAIGuardian.json";
import riskControllerArtifact from "../../artifacts/contracts/RiskController.sol/RiskController.json";
import { DEFAULT_RPC_URL, deployment } from "@/lib/deployment";
import { getProvider, getSigner } from "@/hooks/useWallet";

type RiskControllerParameters = {
  maxPositionBps: number;
  liquidationThresholdBps: number;
  rebalanceThresholdBps: number;
};

export type ProtocolStatus = {
  contractAddress: string;
  paused: boolean;
  parameters: RiskControllerParameters;
};

export type GuardianState = {
  active: boolean;
  lastRiskScore: number;
  lastUpdated: number;
  latestSummary: string;
};

let readProviderInstance: JsonRpcProvider | null = null;

function getReadProvider() {
  if (!readProviderInstance) {
    readProviderInstance = new JsonRpcProvider(DEFAULT_RPC_URL);
  }

  return readProviderInstance;
}

function getContractAddress(name: "guardian" | "riskController") {
  if (name === "guardian") {
    return deployment.guardianContractAddress;
  }

  return deployment.riskControllerAddress;
}

function createContract(address: string, abi: InterfaceAbi, runner: ContractRunner) {
  return new Contract(address, abi, runner);
}

export function getGuardianContract(runner: ContractRunner = getReadProvider()) {
  return createContract(
    getContractAddress("guardian"),
    guardianArtifact.abi as InterfaceAbi,
    runner,
  );
}

export function getRiskControllerContract(runner: ContractRunner = getReadProvider()) {
  return createContract(
    getContractAddress("riskController"),
    riskControllerArtifact.abi as InterfaceAbi,
    runner,
  );
}

export async function getProtocolStatus(): Promise<ProtocolStatus> {
  const contract = getRiskControllerContract();
  const paused = Boolean(await contract.paused());
  const parameters = await contract.parameters();

  return {
    contractAddress: getContractAddress("riskController"),
    paused,
    parameters: {
      maxPositionBps: Number(parameters.maxPositionBps),
      liquidationThresholdBps: Number(parameters.liquidationThresholdBps),
      rebalanceThresholdBps: Number(parameters.rebalanceThresholdBps),
    },
  };
}

export async function triggerPause() {
  const signer = await getSigner();
  const contract = getRiskControllerContract(signer);
  const transaction = await contract.pauseProtocol();
  const receipt = await transaction.wait();

  return {
    hash: transaction.hash as string,
    blockNumber: receipt?.blockNumber ?? null,
    status: receipt?.status ?? null,
  };
}

export async function resumeProtocol() {
  const signer = await getSigner();
  const contract = getRiskControllerContract(signer);
  const transaction = await contract.unpauseProtocol();
  const receipt = await transaction.wait();

  return {
    hash: transaction.hash as string,
    blockNumber: receipt?.blockNumber ?? null,
    status: receipt?.status ?? null,
  };
}

export async function getGuardianState(account: string): Promise<GuardianState> {
  const contract = getGuardianContract();
  const state = await contract.getGuardianState(account);

  return {
    active: Boolean(state.active),
    lastRiskScore: Number(state.lastRiskScore),
    lastUpdated: Number(state.lastUpdated),
    latestSummary: String(state.latestSummary),
  };
}

export async function connectWalletContractRunner() {
  const provider = getProvider();
  const signer = await getSigner();
  const network = await provider.getNetwork();

  return {
    provider,
    signer,
    chainId: Number(network.chainId),
  };
}
