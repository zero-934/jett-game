/**
 * @file LobbyHeaderFooter.ts
 * @purpose EXACT replica of jett-landing header — seamless game transitions
 * @author Agent 934
 * @date 2026-05-21
 * @license Proprietary
 */

import * as Phaser from 'phaser';

export interface LobbyHeaderFooterConfig {
  scene: Phaser.Scene;
  onBack?: () => void;
  onConnect?: () => void;
  balance?: number;
}

export class LobbyHeaderFooter {
  private scene: Phaser.Scene;
  private config: LobbyHeaderFooterConfig;
  private headerElement: HTMLElement | null = null;

  private readonly HEADER_HEIGHT = 56; // py-3 (12px) + py-1.5 (6px) + text = ~56px
  private readonly GOLD = '#c9a84c';
  private readonly SURFACE = '#1a1a1a';
  private readonly BORDER = '#222222';
  private readonly FOREGROUND = '#f0f0f0';

  constructor(config: LobbyHeaderFooterConfig) {
    this.scene = config.scene;
    this.config = config;
    
    this.buildHeader();
  }

  private buildHeader(): void {

    // Create header container (exact jett-landing style)
    this.headerElement = document.createElement('header');
    this.headerElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      background: rgba(8, 8, 8, 0.95);
      backdrop-filter: blur(4px);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid ${this.BORDER};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      height: ${this.HEADER_HEIGHT}px;
    `;

    // Left side: "jett" text
    const logoSpan = document.createElement('span');
    logoSpan.textContent = 'jett';
    logoSpan.style.cssText = `
      font-size: 20px;
      font-weight: 300;
      color: ${this.FOREGROUND};
      letter-spacing: 2px;
      text-transform: uppercase;
    `;
    this.headerElement.appendChild(logoSpan);

    // Right side: Balance + Connect button
    const rightContainer = document.createElement('div');
    rightContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
    `;

    // Balance display (◎ 2.40 format)
    const balanceBox = document.createElement('div');
    balanceBox.style.cssText = `
      background: ${this.SURFACE};
      padding: 6px 12px;
      border-radius: 9999px;
      border: 1px solid ${this.BORDER};
    `;
    const balanceSpan = document.createElement('span');
    balanceSpan.textContent = `◎ ${(this.config.balance || 0).toFixed(2)}`;
    balanceSpan.style.cssText = `
      color: ${this.GOLD};
      font-size: 14px;
      font-weight: 600;
    `;
    balanceBox.appendChild(balanceSpan);
    rightContainer.appendChild(balanceBox);

    // Connect button (exact style: border, no fill)
    const connectBtn = document.createElement('button');
    connectBtn.textContent = 'Connect';
    connectBtn.style.cssText = `
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid ${this.GOLD};
      background: transparent;
      color: ${this.GOLD};
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s ease;
    `;
    connectBtn.onmouseover = () => {
      connectBtn.style.backgroundColor = 'rgba(201, 168, 76, 0.1)';
    };
    connectBtn.onmouseout = () => {
      connectBtn.style.backgroundColor = 'transparent';
    };
    connectBtn.onclick = () => this.config.onConnect?.();

    rightContainer.appendChild(connectBtn);
    this.headerElement.appendChild(rightContainer);

    // Append to document body
    document.body.appendChild(this.headerElement);
  }

  public updateBalance(amount: number): void {
    if (this.headerElement) {
      const balanceSpan = this.headerElement.querySelector('span');
      if (balanceSpan) {
        const spans = this.headerElement.querySelectorAll('span');
        spans[spans.length - 2].textContent = `◎ ${amount.toFixed(2)}`; // Balance is second-to-last span
      }
    }
  }

  public getHeaderHeight(): number {
    return this.HEADER_HEIGHT;
  }

  public destroy(): void {
    if (this.headerElement && this.headerElement.parentNode) {
      this.headerElement.parentNode.removeChild(this.headerElement);
    }
  }
}
