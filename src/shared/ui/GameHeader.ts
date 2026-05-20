/**
 * @file GameHeader.ts
 * @purpose HTML-based header matching Shuffle style: boxes, crisp text, professional layout
 * @author Agent 934
 * @date 2026-05-20
 * @license Proprietary
 */

import * as Phaser from 'phaser';

export interface GameHeaderConfig {
  scene: Phaser.Scene;
  title: string;
  balance: number;
  onBack: () => void;
}

export class GameHeader {
  private config: GameHeaderConfig;
  private headerContainer: HTMLDivElement;
  private balanceText: HTMLElement;

  private readonly HEADER_HEIGHT = 70;

  constructor(config: GameHeaderConfig) {
    this.config = config;

    // Create HTML container for header
    this.headerContainer = document.createElement('div');
    this.headerContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: ${this.HEADER_HEIGHT}px;
      background: linear-gradient(135deg, #050508 0%, #0a0a0f 100%);
      border-bottom: 2px solid #c9a84c;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      box-sizing: border-box;
      z-index: 1000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    `;

    // Back button (left)
    const backBtn = document.createElement('button');
    backBtn.textContent = '← LOBBY';
    backBtn.style.cssText = `
      background: transparent;
      border: 2px solid #c9a84c;
      color: #c9a84c;
      padding: 8px 14px;
      border-radius: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    `;
    backBtn.onmouseover = () => {
      backBtn.style.backgroundColor = 'rgba(201, 168, 76, 0.15)';
      backBtn.style.boxShadow = '0 0 12px rgba(201, 168, 76, 0.4)';
    };
    backBtn.onmouseout = () => {
      backBtn.style.backgroundColor = 'transparent';
      backBtn.style.boxShadow = 'none';
    };
    backBtn.onclick = () => this.config.onBack();
    this.headerContainer.appendChild(backBtn);

    // Title (center)
    const title = document.createElement('div');
    title.textContent = this.config.title;
    title.style.cssText = `
      font-size: 18px;
      font-weight: 700;
      color: #c9a84c;
      letter-spacing: 0.5px;
      flex: 1;
      text-align: center;
    `;
    this.headerContainer.appendChild(title);

    // Balance (right, in box like Shuffle)
    const balanceBox = document.createElement('div');
    balanceBox.style.cssText = `
      border: 1px solid #444;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 12px;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    const balanceIcon = document.createElement('span');
    balanceIcon.textContent = '💰';
    balanceIcon.style.fontSize = '16px';
    balanceBox.appendChild(balanceIcon);

    this.balanceText = document.createElement('span');
    this.balanceText.textContent = `${this.config.balance.toFixed(2)}`;
    this.balanceText.style.cssText = `
      font-size: 13px;
      font-weight: 700;
      color: #c9a84c;
    `;
    balanceBox.appendChild(this.balanceText);

    this.headerContainer.appendChild(balanceBox);

    // Jett logo (right, like Shuffle branding)
    const logo = document.createElement('div');
    logo.textContent = '✈️ JETT';
    logo.style.cssText = `
      font-size: 14px;
      font-weight: 700;
      color: #c9a84c;
      letter-spacing: 0.5px;
      margin-left: 16px;
      white-space: nowrap;
    `;
    this.headerContainer.appendChild(logo);

    // Attach to DOM (append to parent container)
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
