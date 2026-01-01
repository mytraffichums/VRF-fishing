export const RANDOM_NUMBER_CONTRACT_ADDRESS =
  "0x86AC0F39a6f7Ed37219Bf7618a328DA76C4b1894" as const;

export const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export const RANDOM_NUMBER_ABI = [
  {
    inputs: [{ internalType: "address", name: "entropyAddress", type: "address" }],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "uint64", name: "sequenceNumber", type: "uint64" },
      { indexed: false, internalType: "bytes32", name: "randomNumber", type: "bytes32" },
    ],
    name: "RandomNumberReceived",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "uint64", name: "sequenceNumber", type: "uint64" },
    ],
    name: "RandomNumberRequested",
    type: "event",
  },
  {
    inputs: [],
    name: "entropy",
    outputs: [{ internalType: "contract IEntropyV2", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getFee",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint64", name: "sequenceNumber", type: "uint64" }],
    name: "getRandomUint256",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "lastRandomNumber",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "lastSequenceNumber",
    outputs: [{ internalType: "uint64", name: "", type: "uint64" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint64", name: "", type: "uint64" }],
    name: "randomNumbers",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "requestRandomNumber",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint64", name: "sequenceNumber", type: "uint64" },
      { internalType: "address", name: "provider", type: "address" },
      { internalType: "bytes32", name: "randomNumber", type: "bytes32" },
    ],
    name: "_entropyCallback",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
