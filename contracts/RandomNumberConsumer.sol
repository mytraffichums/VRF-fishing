// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IEntropyV2 {
    function requestV2() external payable returns (uint64 sequenceNumber);
    function getFeeV2() external view returns (uint256 fee);
}

abstract contract IEntropyConsumer {
    function _entropyCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    ) external {
        address entropy = getEntropy();
        require(msg.sender == entropy, "Only entropy can call");
        entropyCallback(sequenceNumber, provider, randomNumber);
    }

    function entropyCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    ) internal virtual;

    function getEntropy() internal view virtual returns (address);
}

contract RandomNumberConsumer is IEntropyConsumer {
    IEntropyV2 public entropy;

    mapping(uint64 => bytes32) public randomNumbers;
    uint64 public lastSequenceNumber;
    bytes32 public lastRandomNumber;

    event RandomNumberRequested(uint64 sequenceNumber);
    event RandomNumberReceived(uint64 sequenceNumber, bytes32 randomNumber);

    constructor(address entropyAddress) {
        entropy = IEntropyV2(entropyAddress);
    }

    function requestRandomNumber() external payable {
        uint256 fee = entropy.getFeeV2();
        require(msg.value >= fee, "Insufficient fee");

        uint64 sequenceNumber = entropy.requestV2{value: fee}();
        lastSequenceNumber = sequenceNumber;

        emit RandomNumberRequested(sequenceNumber);

        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }
    }

    function entropyCallback(
        uint64 sequenceNumber,
        address,
        bytes32 randomNumber
    ) internal override {
        randomNumbers[sequenceNumber] = randomNumber;
        lastRandomNumber = randomNumber;
        emit RandomNumberReceived(sequenceNumber, randomNumber);
    }

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    function getFee() external view returns (uint256) {
        return entropy.getFeeV2();
    }

    function getRandomUint256(uint64 sequenceNumber) external view returns (uint256) {
        return uint256(randomNumbers[sequenceNumber]);
    }
}
