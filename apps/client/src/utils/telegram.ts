export class TelegramNotifier {
  constructor(
    private readonly botToken: string,
    private readonly chatId: string,
  ) {}

  async sendMessage(message: string) {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const body = JSON.stringify({
        chat_id: this.chatId,
        text: message,
        disable_web_page_preview: true,
      });

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(
          `[Telegram] Failed to send notification: ${response.status} ${response.statusText} - ${error}`,
        );
      } else {
        console.log("[Telegram] Notification sent successfully");
      }
    } catch (error) {
      console.error("[Telegram] Failed to send notification:", error);
    }
  }

  async liquidationDetected(
    chainId: number,
    marketId: string,
    borrower: string,
    collateralToken: string,
    formattedAmount: string,
    type: "liquidation" | "pre-liquidation",
  ) {
    await this.sendMessage(
      [
        `🔴 ${type === "pre-liquidation" ? "Pré-liquidation" : "Liquidation"} détectée`,
        `Chaîne: ${getChainName(chainId)}`,
        `Marché: ${truncateId(marketId)}`,
        `Emprunteur: ${truncateAddress(borrower)}`,
        `Collatéral: ${formattedAmount} (${truncateAddress(collateralToken)})`,
      ].join("\n"),
    );
  }

  async liquidationExecuted(
    chainId: number,
    marketId: string,
    borrower: string,
    profitUsd: number | undefined,
    txHash: string | undefined,
    type: "liquidation" | "pre-liquidation",
  ) {
    const explorerLink = txHash ? getExplorerTxUrl(chainId, txHash) : undefined;
    const profitText = profitUsd === undefined ? "inconnu" : `$${profitUsd.toFixed(2)}`;
    const message = [
      `✅ ${type === "pre-liquidation" ? "Pré-liquidation" : "Liquidation"} exécutée`,
      `Chaîne: ${getChainName(chainId)}`,
      `Marché: ${truncateId(marketId)}`,
      `Emprunteur: ${truncateAddress(borrower)}`,
      `Profit: ${profitText}`,
    ];
    if (explorerLink) message.push(`Tx: ${explorerLink}`);
    await this.sendMessage(message.join("\n"));
  }

  async liquidationFailed(
    chainId: number,
    marketId: string,
    borrower: string,
    reason: string,
    type: "liquidation" | "pre-liquidation",
  ) {
    const truncated = reason.length > 200 ? reason.slice(0, 200) + "..." : reason;
    await this.sendMessage(
      [
        `❌ ${type === "pre-liquidation" ? "Pré-liquidation" : "Liquidation"} échouée`,
        `Chaîne: ${getChainName(chainId)}`,
        `Marché: ${truncateId(marketId)}`,
        `Emprunteur: ${truncateAddress(borrower)}`,
        `Raison: ${truncated}`,
      ].join("\n"),
    );
  }

  async botStarted(chains: number[]) {
    const timestamp = formatTimestamp(new Date());
    const chainList = chains.map((id) => `${getChainName(id)} (${id})`).join(", ");
    await this.sendMessage(`✅ Bot lancé — ${timestamp}\nChaînes: ${chainList}`);
  }

  async rpcDown(chainName: string, rpcCount: number) {
    const timestamp = formatTimestamp(new Date());
    await this.sendMessage(
      `🚨 ${chainName} — Plus aucun RPC disponible\n${rpcCount} RPC(s) essayé(s) — le bot ne peut plus scanner.\n${timestamp}`,
    );
  }
}

export function createTelegramNotifier(): TelegramNotifier | undefined {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  if (!telegramBotToken || !telegramChatId) {
    console.log("[Telegram] Notifier disabled (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set)");
    return undefined;
  }
  console.log(`[Telegram] Notifier enabled (chatId: ${telegramChatId})`);
  return new TelegramNotifier(telegramBotToken, telegramChatId);
}

function getChainName(chainId: number): string {
  const names: Record<number, string> = {
    1: "Ethereum",
    8453: "Base",
    42161: "Arbitrum",
    999: "HyperEVM",
    130: "Unichain",
    747: "Katana",
    480: "Worldchain",
    10143: "Monad",
    11155111: "Sepolia",
  };
  return names[chainId] ?? `Chain ${chainId}`;
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function truncateId(id: string): string {
  if (id.length <= 18) return id;
  return `${id.slice(0, 10)}...${id.slice(-6)}`;
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function getExplorerTxUrl(chainId: number, txHash: string) {
  switch (chainId) {
    case 11155111:
      return `https://sepolia.etherscan.io/tx/${txHash}`;
    case 8453:
      return `https://base.etherscan.io/tx/${txHash}`;
    case 42161:
      return `https://arbiscan.io/tx/${txHash}`;
    case 999:
      return `https://hyperevmscan.io/tx/${txHash}`;
    default:
      return undefined;
  }
}
