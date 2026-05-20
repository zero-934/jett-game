/**
 * @file GameHeader.ts
 * @purpose HTML-based header matching Shuffle style: logo, balance, title
 * @author Agent 934
 * @date 2026-05-20
 * @license Proprietary
 */

export interface GameHeaderConfig {
  scene: any; // Phaser.Scene (avoiding import for HTML-only component)
  title: string;
  balance: number;
  onBack: () => void;
}

export class GameHeader {
  private config: GameHeaderConfig;
  private headerContainer: HTMLDivElement;
  private balanceText: HTMLElement;

  private readonly HEADER_HEIGHT = 80;

  constructor(config: GameHeaderConfig) {
    this.config = config;

    // Create header container
    this.headerContainer = document.createElement('div');
    this.headerContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: ${this.HEADER_HEIGHT}px;
      background: #0a0a0f;
      border-bottom: 2px solid #c9a84c;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      box-sizing: border-box;
      z-index: 1000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    `;

    // Logo/Brand (left)
    const logo = document.createElement('div');
    logo.textContent = '✈️';
    logo.style.cssText = `
      font-size: 28px;
      font-weight: 700;
      color: #c9a84c;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    `;
    this.headerContainer.appendChild(logo);

    // Title (center, LARGE and crisp)
    const title = document.createElement('div');
    title.textContent = this.config.title;
    title.style.cssText = `
      font-size: 28px;
      font-weight: 900;
      color: #c9a84c;
      letter-spacing: 1.5px;
      flex: 1;
      text-align: center;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
    `;
    this.headerContainer.appendChild(title);

    // Balance box (right, like Shuffle's dropdown)
    const balanceBox = document.createElement('div');
    balanceBox.style.cssText = `
      border: 2px solid #c9a84c !important;
      background: rgba(201, 168, 76, 0.12) !important;
      border-radius: 12px;
      padding: 12px 18px;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 150px;
      flex-shrink: 0;
      box-shadow: 0 0 8px rgba(201, 168, 76, 0.2);
    `;

    const balanceIcon = document.createElement('span');
    balanceIcon.textContent = '💰';
    balanceIcon.style.fontSize = '16px';
    balanceBox.appendChild(balanceIcon);

    this.balanceText = document.createElement('span');
    this.balanceText.textContent = `${this.config.balance.toFixed(2)}`;
    this.balanceText.style.cssText = `
      font-size: 14px;
      font-weight: 700;
      color: #c9a84c;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    `;
    balanceBox.appendChild(this.balanceText);

    // Back button (right, after balance)
    const backBtn = document.createElement('button');
    backBtn.textContent = '← LOBBY';
    backBtn.style.cssText = `
      background: transparent;
      border: 1.5px solid #c9a84c;
      color: #c9a84c;
      padding: 10px 16px;
      border-radius: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
      margin-left: 8px;
      flex-shrink: 0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    `;
    backBtn.onmouseover = () => {
      backBtn.style.backgroundColor = 'rgba(201, 168, 76, 0.1)';
      backBtn.style.boxShadow = '0 0 12px rgba(201, 168, 76, 0.3)';
    };
    backBtn.onmouseout = () => {
      backBtn.style.backgroundColor = 'transparent';
      backBtn.style.boxShadow = 'none';
    };
    backBtn.onclick = () => this.config.onBack();

    this.headerContainer.appendChild(balanceBox);
    this.headerContainer.appendChild(backBtn);

    // Attach to DOM
    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.style.position = 'relative';
      appContainer.appendChild(this.headerContainer);
    }
  }

  public updateBalance(amount: number): void {
    this.config.balance = amount;
    this.balanceText.textContent = amount.toFixed(2);
  }

  public getHeight(): number {
    return this.HEADER_HEIGHT;
  }

  public destroy(): void {
    if (this.headerContainer && this.headerContainer.parentNode) {
      this.headerContainer.parentNode.removeChild(this.headerContainer);
    }
  }
}
