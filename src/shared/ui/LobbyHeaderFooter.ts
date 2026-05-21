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
  onHome?: () => void;
  onGames?: () => void;
  onHistory?: () => void;
  onRadio?: () => void;
}

export class LobbyHeaderFooter {
  private config: LobbyHeaderFooterConfig;
  private headerElement: HTMLElement | null = null;

  private readonly HEADER_HEIGHT = 56; // py-3 (12px) + py-1.5 (6px) + text = ~56px
  private readonly GOLD = '#c9a84c';
  private readonly SURFACE = '#1a1a1a';
  private readonly BORDER = '#222222';
  private readonly FOREGROUND = '#f0f0f0';

  constructor(config: LobbyHeaderFooterConfig) {
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

    // Left side: "jett" text (clickable → lobby)
    const logoSpan = document.createElement('button');
    logoSpan.textContent = 'jett';
    logoSpan.style.cssText = `
      font-size: 20px;
      font-weight: 300;
      color: ${this.FOREGROUND};
      letter-spacing: 2px;
      text-transform: uppercase;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0;
      margin: 0;
      transition: opacity 0.15s ease;
    `;
    logoSpan.onmouseover = () => {
      logoSpan.style.opacity = '0.7';
    };
    logoSpan.onmouseout = () => {
      logoSpan.style.opacity = '1';
    };
    logoSpan.onclick = () => this.config.onBack?.();
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

    // Build footer with nav bar (Home | Games | History | Radio)
    this.buildFooter();
  }

  private buildFooter(): void {
    // Create footer container (exact jett-landing style)
    const footerElement = document.createElement('footer');
    footerElement.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      background: ${this.SURFACE};
      border-top: 1px solid ${this.BORDER};
      padding: 12px 0;
      display: flex;
      justify-content: space-around;
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      height: 70px;
    `;

    // Navigation items (Home, Games, History, Radio)
    const navItems = [
      { label: 'Home', icon: '🏠', onClick: this.config.onHome },
      { label: 'Games', icon: '🎮', onClick: this.config.onGames },
      { label: 'History', icon: '📊', onClick: this.config.onHistory },
      { label: 'Radio', icon: '📻', onClick: this.config.onRadio },
    ];

    navItems.forEach((item) => {
      const navBtn = document.createElement('button');
      navBtn.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 0;
        transition: opacity 0.15s ease;
      `;
      navBtn.onmouseover = () => {
        navBtn.style.opacity = '0.7';
      };
      navBtn.onmouseout = () => {
        navBtn.style.opacity = '1';
      };
      navBtn.onclick = () => item.onClick?.();

      // Icon
      const icon = document.createElement('span');
      icon.textContent = item.icon;
      icon.style.cssText = `
        font-size: 24px;
      `;
      navBtn.appendChild(icon);

      // Label
      const label = document.createElement('span');
      label.textContent = item.label;
      label.style.cssText = `
        font-size: 12px;
        color: #666666;
        font-weight: 500;
      `;
      navBtn.appendChild(label);

      footerElement.appendChild(navBtn);
    });

    document.body.appendChild(footerElement);
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
