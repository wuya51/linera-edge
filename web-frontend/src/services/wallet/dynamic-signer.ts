import type { Signer } from "@linera/client";
import type { Wallet as DynamicWallet } from "@dynamic-labs/sdk-react-core";
import { isEthereumWallet } from "@dynamic-labs/ethereum";

export class DynamicSigner implements Signer {
  private dynamicWallet: DynamicWallet;

  constructor(dynamicWallet: DynamicWallet) {
    this.dynamicWallet = dynamicWallet;
  }

  async address(): Promise<string> {
    return this.dynamicWallet.address;
  }

  async containsKey(owner: string): Promise<boolean> {
    const walletAddress = this.dynamicWallet.address;
    return owner.toLowerCase() === walletAddress.toLowerCase();
  }

  async sign(owner: string, value: Uint8Array): Promise<string> {
    const address: `0x${string}` = owner as `0x${string}`;
    const primaryWallet = this.dynamicWallet.address;

    if (!primaryWallet || !owner) {
      throw new Error("No primary wallet found");
    }

    if (owner.toLowerCase() !== primaryWallet.toLowerCase()) {
      throw new Error("Owner does not match primary wallet");
    }

    try {
      const msgHex: `0x${string}` = `0x${uint8ArrayToHex(value)}`;

      if (!isEthereumWallet(this.dynamicWallet)) throw new Error();
      const walletClient = await this.dynamicWallet.getWalletClient();
      const signature = await walletClient.request({
        method: "personal_sign",
        params: [msgHex, address],
      });

      if (!signature) throw new Error("Failed to sign message");
      return signature;
    } catch (error: any) {
      console.error("Failed to sign message:", error);
      throw new Error(
        `Dynamic signature request failed: ${error?.message || error}`
      );
    }
  }
}

function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");
}