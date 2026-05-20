/**
 * @file GameFooter.ts
 * @purpose HTML-based footer: bet selector, fair verification, wallet, etc. (Shuffle-style boxes)
 * @author Agent 934
 * @date 2026-05-20
 * @license Proprietary
 */

export interface GameFooterConfig {
  scene: any; // Phaser.Scene type (avoiding import for HTML-only component)
  gameKey: string;
  betOptions?: number[];
  selectedBet?: number;
  onBetChange?: (bet: number) => void;
  onFairVerify?: () => void;
  onTransactionHistory?: () => void;
  onWalletConnect?: () => void;
  onSettings?: () => void;
  walletConnected?: boolean;
  walletName?: string;
  networkName?: string;
}

export class GameFooter {
  private config: GameFooterConfig;
  private footerContainer: HTMLDivElement;
  private betButton: HTMLElement;
  private walletText: HTMLElement;
  private betDropdown: HTMLDivElement | null = null;

  private readonly FOOTER_HEIGHT = 70;
  private readonly GOLD = '#c9a84c';

  constructor(config: GameFooterConfig) {
    this.config = {
      betOptions: [10, 25, 50, 100],
      selectedBet: 10,
      walletConnected: false,
      walletName: 'Phantom',
      networkName: 'DEVNET',
      ...config,
    };

    // Create footer container
    this.footerContainer = document.createElement('div');
    this.footerContainer.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      height: ${this.FOOTER_HEIGHT}px;
      background: #050508;
      border-top: 1px solid #c9a84c;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      box-sizing: border-box;
      z-index: 1000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      gap: 12px;
    `;

    // Bet selector
    const betBox = document.createElement('div');
    betBox.style.cssText = `
      border: 1px solid #444;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 12px;
      padding: 8px 12px;
      position: relative;
    `;

    this.betButton = document.createElement('button');
    this.betButton.textContent = `BET: ${this.config.selectedBet}`;
    this.betButton.style.cssText = `
      background: transparent;
      border: none;
      color: ${this.GOLD};
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
    `;
    this.betButton.onclick = () => this.toggleBetDropdown();
    betBox.appendChild(this.betButton);
    this.footerContainer.appendChild(betBox);

    // Fair verification
    const fairBtn = document.createElement('button');
    fairBtn.textContent = '⚡ FAIR';
    fairBtn.style.cssText = `
      background: transparent;
      border: 1px solid #444;
      color: ${this.GOLD};
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s ease;
    `;
    fairBtn.onmouseover = () => fairBtn.style.borderColor = this.GOLD;
    fairBtn.onmouseout = () => fairBtn.style.borderColor = '#444';
    fairBtn.onclick = () => this.config.onFairVerify?.();
    this.footerContainer.appendChild(fairBtn);

    // Transaction history
    const txnBtn = document.createElement('button');
    txnBtn.textContent = '📊 TXN';
    txnBtn.style.cssText = `
      background: transparent;
      border: 1px solid #444;
      color: ${this.GOLD};
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s ease;
    `;
    txnBtn.onmouseover = () => txnBtn.style.borderColor = this.GOLD;
    txnBtn.onmouseout = () => txnBtn.style.borderColor = '#444';
    txnBtn.onclick = () => this.config.onTransactionHistory?.();
    this.footerContainer.appendChild(txnBtn);

    // Wallet state
    const walletStatus = this.config.walletConnected ? `${this.config.walletName}` : 'CONNECT';
    const walletColor = this.config.walletConnected ? this.GOLD : '#ff6b6b';

    this.walletText = document.createElement('button');
    this.walletText.textContent = `🔗 ${walletStatus}`;
    this.walletText.style.cssText = `
      background: transparent;
      border: 1px solid #444;
      color: ${walletColor};
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s ease;
    `;
    this.walletText.onmouseover = () => this.walletText.style.borderColor = walletColor;
    this.walletText.onmouseout = () => this.walletText.style.borderColor = '#444';
    this.walletText.onclick = () => this.config.onWalletConnect?.();
    this.footerContainer.appendChild(this.walletText);

    // Spacer
    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    this.footerContainer.appendChild(spacer);

    // Settings
    const settingsBtn = document.createElement('button');
    settingsBtn.textContent = '⚙️';
    settingsBtn.style.cssText = `
      background: transparent;
      border: 1px solid #444;
      color: ${this.GOLD};
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s ease;
    `;
    settingsBtn.onmouseover = () => settingsBtn.style.borderColor = this.GOLD;
    settingsBtn.onmouseout = () => settingsBtn.style.borderColor = '#444';
    settingsBtn.onclick = () => this.config.onSettings?.();
    this.footerContainer.appendChild(settingsBtn);

    // Attach to DOM
    document.body.appendChild(this.footerContainer);
  }

  private toggleBetDropdown(): void {
    if (this.betDropdown) {
      this.betDropdown.remove();
      this.betDropdown = null;
      return;
    }

    const betOptions = this.config.betOptions || [10, 25, 50, 100];

    this.betDropdown = document.createElement('div');
    this.betDropdown.style.cssText = `
      position: absolute;
      bottom: 100%;
      left: 0;
      background: #1a1a1f;
      border: 1px solid #c9a84c;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 8px;
      z-index: 1001;
    `;

    betOptions.forEach(bet => {
      const option = document.createElement('div');
      option.textContent = `${bet}`;
      option.style.cssText = `
        padding: 10px 16px;
        color: ${bet === this.config.selectedBet ? this.GOLD : '#ffffff'};
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.1s ease;
        border-bottom: 1px solid #333;
      `;
      option.onmouseover = () => option.style.backgroundColor = 'rgba(201, 168, 76, 0.1)';
      option.onmouseout = () => option.style.backgroundColor = 'transparent';
      option.onclick = () => this.selectBet(bet);
      this.betDropdown!.appendChild(option);
    });

    // Find bet box and append dropdown
    const betButton = this.footerContainer.querySelector('button');
    if (betButton?.parentElement) {
      betButton.parentElement.style.position = 'relative';
      betButton.parentElement.appendChild(this.betDropdown);
    }
  }

  private selectBet(bet: number): void {
    this.config.selectedBet = bet;
    this.betButton.textContent = `BET: ${bet}`;

    if (this.betDropdown) {
      this.betDropdown.remove();
      this.betDropdown = null;
    }

    if (this.config.onBetChange) {
      this.config.onBetChange(bet);
    }
  }

  public updateWalletState(connected: boolean, walletName?: string): void {
    this.config.walletConnected = connected;
    if (walletName) this.config.walletName = walletName;

    const status = connected ? `${walletName || 'CONNECTED'}` : 'CONNECT';
    const color = connected ? this.GOLD : '#ff6b6b';

    this.walletText.textContent = `🔗 ${status}`;
    this.walletText.style.color = color;
  }

  public getHeight(): number {
    return this.FOOTER_HEIGHT;
  }

  public destroy(): void {
    if (this.footerContainer && this.footerContainer.parentNode) {
      this.footerContainer.parentNode.removeChild(this.footerContainer);
    }
  }
}
