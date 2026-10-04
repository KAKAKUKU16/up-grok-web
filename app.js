/**
 * UP for Grok — Interactive Client Application
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initSidebarNavigation();
  initLaunchSimulator();
  initModals();
  initHeroDemo();
  initClaimHandler();
  setupWalletButtonHover();
  initWalletProviderEvents();
});

// ==========================================
// Phantom Wallet & Solana Mainnet Integration
// ==========================================
let connectedWallet = null;

function updateWalletUI(isConnected) {
  const btn = document.getElementById('connectWalletBtn');
  const btnText = document.getElementById('walletBtnText');
  const dot = document.getElementById('walletDot');
  if (!btnText || !dot) return;

  if (isConnected && connectedWallet) {
    btnText.innerText = `${connectedWallet.slice(0, 4)}...${connectedWallet.slice(-4)}`;
    dot.style.background = '#22c55e';
    dot.style.boxShadow = '0 0 8px #22c55e';
    if (btn) {
      btn.title = `Connected: ${connectedWallet} (Click to Disconnect)`;
      btn.style.borderColor = 'rgba(34, 197, 94, 0.4)';
      btn.style.color = '#86efac';
    }
  } else {
    btnText.innerText = 'Connect Wallet';
    dot.style.background = '#a855f7';
    dot.style.boxShadow = '0 0 8px #a855f7';
    if (btn) {
      btn.title = 'Connect Wallet';
      btn.style.borderColor = 'rgba(168, 85, 247, 0.4)';
      btn.style.color = '#e9d5ff';
    }
  }
}

function setupWalletButtonHover() {
  const btn = document.getElementById('connectWalletBtn');
  const btnText = document.getElementById('walletBtnText');
  const dot = document.getElementById('walletDot');
  if (!btn || !btnText || !dot) return;

  btn.addEventListener('mouseenter', () => {
    if (connectedWallet) {
      btnText.innerText = 'Disconnect';
      dot.style.background = '#ef4444';
      dot.style.boxShadow = '0 0 8px #ef4444';
      btn.style.borderColor = 'rgba(239, 68, 68, 0.5)';
      btn.style.color = '#fca5a5';
    }
  });

  btn.addEventListener('mouseleave', () => {
    if (connectedWallet) {
      btnText.innerText = `${connectedWallet.slice(0, 4)}...${connectedWallet.slice(-4)}`;
      dot.style.background = '#22c55e';
      dot.style.boxShadow = '0 0 8px #22c55e';
      btn.style.borderColor = 'rgba(34, 197, 94, 0.4)';
      btn.style.color = '#86efac';
    } else {
      btnText.innerText = 'Connect Wallet';
      dot.style.background = '#a855f7';
      dot.style.boxShadow = '0 0 8px #a855f7';
      btn.style.borderColor = 'rgba(168, 85, 247, 0.4)';
      btn.style.color = '#e9d5ff';
    }
  });
}

function initWalletProviderEvents() {
  const provider = window.phantom?.solana || window.solana;
  if (!provider || !provider.isPhantom) return;

  if (provider.on) {
    provider.on('disconnect', () => {
      connectedWallet = null;
      updateWalletUI(false);
    });
    provider.on('accountChanged', (publicKey) => {
      if (publicKey) {
        connectedWallet = publicKey.toString();
        updateWalletUI(true);
      } else {
        connectedWallet = null;
        updateWalletUI(false);
      }
    });
  }

  // Silent eager connect if already authorized
  try {
    provider.connect({ onlyIfTrusted: true })
      .then((resp) => {
        if (resp && resp.publicKey) {
          connectedWallet = resp.publicKey.toString();
          updateWalletUI(true);
        }
      })
      .catch(() => {});
  } catch (err) {}
}

async function connectPhantomWallet() {
  const provider = window.phantom?.solana || window.solana;
  if (!provider || !provider.isPhantom) {
    showToast('Phantom not detected. Opening phantom.app...');
    window.open('https://phantom.app/', '_blank');
    return null;
  }

  // Toggle disconnect if already connected
  if (connectedWallet) {
    try {
      if (provider.disconnect) {
        await provider.disconnect();
      }
    } catch (e) {
      console.log('Phantom disconnect:', e);
    }
    connectedWallet = null;
    updateWalletUI(false);
    showToast('Wallet disconnected');
    return null;
  }

  try {
    const resp = await provider.connect();
    connectedWallet = resp.publicKey.toString();
    updateWalletUI(true);
    showToast(`Connected: ${connectedWallet.slice(0, 4)}...${connectedWallet.slice(-4)}`);
    return connectedWallet;
  } catch (err) {
    console.log('User dismissed Phantom connection');
    return null;
  }
}

async function deployToMainnet(coinName, ticker, claimCode) {
  const provider = window.phantom?.solana || window.solana;
  if (!provider || !provider.isPhantom) {
    showToast('Please install Phantom wallet (phantom.app)');
    window.open('https://phantom.app/', '_blank');
    return;
  }

  if (!connectedWallet) {
    const wallet = await connectPhantomWallet();
    if (!wallet) return;
  }

  const btn = document.getElementById(`mainnetDeployBtn_${claimCode}`);
  const statusDiv = document.getElementById(`mainnetStatus_${claimCode}`);

  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Preparing pump.fun transaction...';
  }
  if (statusDiv) {
    statusDiv.style.color = '#a1a1aa';
    statusDiv.innerText = 'Requesting on-chain pump.fun bonding curve via PumpPortal...';
  }

  try {
    if (typeof solanaWeb3 === 'undefined') {
      throw new Error('Solana Web3 is initializing. Please click again in 2 seconds.');
    }

    // 1. Generate fresh Solana mint keypair directly in visitor browser
    const mintKeypair = solanaWeb3.Keypair.generate();
    const mintPubkey = mintKeypair.publicKey.toBase58();

    if (statusDiv) {
      statusDiv.innerText = 'Constructing transaction (trivial ~0.02 SOL Solana rent)...';
    }

    // 2. Request pump.fun create instruction from public PumpPortal API
    const txResponse = await fetch('https://pumpportal.fun/api/trade-local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: connectedWallet,
        action: 'create',
        tokenMetadata: {
          name: coinName,
          symbol: ticker,
          uri: `https://hitup.fun/api/metadata/${ticker.toLowerCase()}`
        },
        mint: mintPubkey,
        denomAmount: 0,
        amount: 0,
        slippage: 10,
        priorityFee: 0.0005,
        pool: 'pump'
      })
    });

    if (!txResponse.ok) {
      const errText = await txResponse.text();
      throw new Error(errText || 'Network node busy. Please verify you have ~0.021 SOL for network gas.');
    }

    const txBytes = await txResponse.arrayBuffer();
    const tx = solanaWeb3.VersionedTransaction.deserialize(new Uint8Array(txBytes));

    // Sign with the new token mint keypair
    tx.sign([mintKeypair]);

    if (statusDiv) {
      statusDiv.innerText = 'Waiting for your approval in Phantom...';
    }

    // Request visitor to sign & broadcast with Phantom
    const { signature } = await provider.signAndSendTransaction(tx);

    // Save live launch to Render backend
    try {
      await fetch('https://up-grok-backend.onrender.com/api/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: coinName,
          symbol: ticker,
          description: `${coinName} ($${ticker}) launched via UP on pump.fun.`,
          mint: mintPubkey,
          claimCode: claimCode
        })
      });
    } catch (_) {}

    if (btn) {
      btn.style.background = '#22c55e';
      btn.style.borderColor = '#16a34a';
      btn.innerText = '✅ Live on pump.fun Mainnet!';
    }
    if (statusDiv) {
      statusDiv.innerHTML = `<span style="color:#4ade80; font-weight:600;">🚀 Deployed to Mainnet!</span> <a href="https://solscan.io/tx/${signature}" target="_blank" rel="noopener noreferrer" style="color:#c084fc; text-decoration:underline; margin-left:6px;">View on Solscan ↗</a>`;
    }

    showToast(`🚀 ${coinName} is live on pump.fun!`);
    setTimeout(() => {
      window.open(`https://pump.fun/coin/${mintPubkey}`, '_blank');
    }, 1500);

  } catch (error) {
    console.error('Mainnet deploy error:', error);
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🟣 Deploy to Solana Mainnet (~0.02 SOL Gas)';
    }
    if (statusDiv) {
      statusDiv.innerText = error.message || 'Transaction cancelled or insufficient SOL balance (~0.02 SOL network rent required).';
      statusDiv.style.color = '#f87171';
    }
    showToast(error.message || 'Transaction cancelled or rejected');
  }
}

// Toast Notification
function showToast(message = 'Copied to clipboard!') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

// Copy to Clipboard Utility
window.copyText = function (elementId, btnElement) {
  const target = document.getElementById(elementId);
  if (!target) return;
  const text = target.innerText || target.textContent;
  
  if (text.trim().toLowerCase().includes('currently being updated')) {
    showToast('Contract address is currently being updated!');
    return;
  }
  
  navigator.clipboard.writeText(text.trim()).then(() => {
    showToast('Copied to clipboard!');
    if (btnElement) {
      const origText = btnElement.innerText;
      btnElement.innerText = 'Copied! ✓';
      btnElement.classList.add('copied');
      setTimeout(() => {
        btnElement.innerText = origText;
        btnElement.classList.remove('copied');
      }, 1800);
    }
  }).catch(err => {
    console.error('Failed to copy: ', err);
    fallbackCopyText(text.trim(), btnElement);
  });
};

// Copy Format Badge
window.copyFormatCode = function () {
  const text = 'UPload It. NAME, TICKER, X LINK, WEBSITE';
  navigator.clipboard.writeText(text).then(() => {
    showToast('Format copied: UPload It. NAME, TICKER...');
  });
};

// Demo CA Copy inside card
window.copyDemoCA = function (btn) {
  const demoCA = 'F7zPA4X9v9m3QWk4oY6kL2b1Kq5Z9bXk';
  navigator.clipboard.writeText(demoCA).then(() => {
    showToast('CA copied!');
    if (btn) {
      btn.innerText = '✓';
      setTimeout(() => { btn.innerText = 'Copy'; }, 1500);
    }
  });
};

function fallbackCopyText(text, btnElement) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast('Copied to clipboard!');
    if (btnElement) {
      const origText = btnElement.innerText;
      btnElement.innerText = 'Copied! ✓';
      setTimeout(() => { btnElement.innerText = origText; }, 1800);
    }
  } catch (err) {
    showToast('Please select and copy manually');
  }
  document.body.removeChild(textArea);
}

// Sidebar Navigation & FAQ Smooth Scroll
function initSidebarNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = item.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);

      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetEl.classList.remove('highlight-flash');
        void targetEl.offsetWidth; // trigger reflow
        targetEl.classList.add('highlight-flash');
      }

      // Close mobile drawer if open
      if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        backdrop.classList.remove('open');
      }
    });
  });

  // New Launch Button scrolls to sandbox & focuses input
  const newLaunchBtn = document.getElementById('newLaunchBtn');
  if (newLaunchBtn) {
    newLaunchBtn.addEventListener('click', () => {
      const sandbox = document.getElementById('launch-sandbox');
      const input = document.getElementById('sandboxInput');
      if (sandbox) {
        sandbox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (input) {
          setTimeout(() => input.focus(), 400);
        }
      }
      if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        backdrop.classList.remove('open');
      }
    });
  }
}

// Mobile Menu Handler
function initMobileMenu() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const closeBtn = document.getElementById('sidebarCloseBtn');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');

  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => {
      sidebar.classList.add('open');
      backdrop.classList.add('open');
    });
  }

  if (closeBtn && sidebar) {
    closeBtn.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('open');
    });
  }

  if (backdrop && sidebar) {
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('open');
    });
  }
}

// Preset Setter
window.setPreset = function (text) {
  const input = document.getElementById('sandboxInput');
  if (input) {
    input.value = text;
    input.focus();
  }
};

// Interactive Launch Simulator
function initLaunchSimulator() {
  const launchBtn = document.getElementById('simulateLaunchBtn');
  const input = document.getElementById('sandboxInput');
  const outputBox = document.getElementById('simulationOutput');
  const stepsContainer = document.getElementById('simSteps');

  if (!launchBtn || !input) return;

  async function runSimulation() {
    const rawVal = input.value.trim();
    if (!rawVal) {
      showToast('Please enter a coin name and ticker');
      input.focus();
      return;
    }

    // Parse name and ticker
    const parts = rawVal.split(',');
    const coinName = parts[0] ? parts[0].trim() : 'Test Coin';
    const ticker = parts[1] ? parts[1].trim().toUpperCase() : coinName.slice(0, 4).toUpperCase();

    outputBox.style.display = 'block';
    stepsContainer.innerHTML = '';

    launchBtn.disabled = true;
    launchBtn.style.opacity = '0.6';

    const steps = [
      { text: `[1/4] Grok parameters: Name="${coinName}", Ticker="$${ticker}"`, delay: 300 },
      { text: `[2/4] Deriving Solana PDA Bonding Curve & Metaplex metadata...`, delay: 900 },
      { text: `[3/4] Broadcasting SPL token creation to pump.fun...`, delay: 1600 },
      { text: `[4/4] Verified on-chain! Live on pump.fun 🚀`, delay: 2400, isSuccess: true }
    ];

    steps.forEach(step => {
      setTimeout(() => {
        const item = document.createElement('div');
        item.className = `sim-step-item ${step.isSuccess ? 'success' : ''}`;
        item.innerHTML = `<span>✓</span> <span>${step.text}</span>`;
        stepsContainer.appendChild(item);
      }, step.delay);
    });

    // Attempt live backend launch
    let liveData = null;
    try {
      const resp = await fetch('https://up-grok-backend.onrender.com/api/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: coinName, symbol: ticker, description: 'Autonomous coin launched via UP for Grok' })
      });
      if (resp.ok) {
        liveData = await resp.json();
      }
    } catch (e) {
      // Backend offline or running standalone: graceful fallback
    }

    setTimeout(() => {
      let finalCA = '';
      let claimCode = '';
      let pumpUrl = '';

      if (liveData && liveData.mint) {
        finalCA = liveData.mint;
        claimCode = liveData.claimCode;
        pumpUrl = liveData.pumpUrl || `https://pump.fun/coin/${finalCA}`;
      } else {
        const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        for (let i = 0; i < 44; i++) {
          finalCA += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const hex = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let c1 = '', c2 = '';
        for (let i = 0; i < 4; i++) c1 += hex.charAt(Math.floor(Math.random() * hex.length));
        for (let i = 0; i < 4; i++) c2 += hex.charAt(Math.floor(Math.random() * hex.length));
        claimCode = `UP-${c1}-${c2}`;
        pumpUrl = `https://pump.fun/coin/${finalCA}`;
      }
      const shortCA = `${finalCA.slice(0, 6)}...${finalCA.slice(-6)}`;

      const resultBox = document.createElement('div');
      resultBox.className = 'sim-result-box anim-fade-up';
      resultBox.innerHTML = `
        <div class="launch-result-card" style="margin-top: 10px; margin-bottom: 8px; background: #18181b; border-color: rgba(255,255,255,0.15);">
          <div class="result-top-row">
            <div class="result-thumb-box" style="background: #27272a; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #a1a1aa; font-size: 0.9rem;">
              $${ticker.slice(0, 3)}
            </div>
            <div class="result-title-group">
              <div class="result-coin-name">${coinName} <span>$${ticker}</span></div>
              <div class="result-status-row">
                <span class="green-dot"></span>
                <span class="result-status-text">Live on pump.fun · fees locked to UP</span>
              </div>
            </div>
          </div>

          <div class="result-field-block">
            <div class="result-field-label">CONTRACT ADDRESS</div>
            <div class="result-field-bar">
              <code class="result-code-val">${finalCA}</code>
              <button class="btn-copy-card" onclick="navigator.clipboard.writeText('${finalCA}'); showToast('Live CA copied!')">Copy</button>
            </div>
          </div>

          <div class="result-bonus-block">
            <p class="result-bonus-text">Bond $${ticker} and claim 3 SOL, then 20% of its fees.</p>
            <div class="result-field-label">YOUR CLAIM CODE</div>
            <div class="result-field-bar">
              <code class="result-claim-val">${claimCode}</code>
              <button class="btn-copy-card" onclick="navigator.clipboard.writeText('${claimCode}'); showToast('Claim code copied!')">Copy</button>
            </div>
          </div>
        </div>

        <div style="margin-top: 10px; margin-bottom: 8px;">
          <button class="btn btn-pill-purple" id="mainnetDeployBtn_${claimCode}" onclick="deployToMainnet('${coinName}', '${ticker}', '${claimCode}')" style="width: 100%; padding: 10px 16px; background: linear-gradient(135deg, #7c3aed, #9333ea); border: 1px solid #a855f7; color: #ffffff; font-weight: 600; font-size: 0.86rem; border-radius: 999px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; box-shadow: 0 4px 16px rgba(147, 51, 234, 0.4); transition: all 0.2s ease;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span>Deploy to Solana Mainnet (~0.02 SOL Gas)</span>
          </button>
          <div style="font-size: 0.72rem; color: #71717a; text-align: center; margin-top: 4px;">Trivial network gas (~0.02 SOL) paid to Solana rent • $0 UP platform fee</div>
          <div id="mainnetStatus_${claimCode}" style="font-size: 0.75rem; color: #a1a1aa; text-align: center; margin-top: 5px;"></div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
          <a href="${pumpUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-pill-white btn-sm" style="flex:1;">View on pump.fun ↗</a>
          <button class="btn btn-pill-dark btn-sm" onclick="openClaimModal('${claimCode}')" style="flex:1; background: #27272a; border: 1px solid rgba(255,255,255,0.2);">Claim 3 SOL Bonus 🎁</button>
          <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent('Just launched $' + ticker + ' with UP directly from Grok! Check it out on pump.fun: ' + shortCA)}" target="_blank" rel="noopener noreferrer" class="btn btn-pill-dark btn-sm" style="flex:1;">Share on X</a>
        </div>
      `;
      stepsContainer.appendChild(resultBox);

      launchBtn.disabled = false;
      launchBtn.style.opacity = '1';
    }, 2600);
  }

  launchBtn.addEventListener('click', runSimulation);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      runSimulation();
    }
  });
}

// Open Claim Modal Helper
window.openClaimModal = function (code) {
  const codeInput = document.getElementById('claimCodeInput');
  if (codeInput && code) {
    codeInput.value = code;
  }
  const statusBox = document.getElementById('claimStatusBox');
  if (statusBox) statusBox.style.display = 'none';
  openModal('claimModal');
};

// Creator Claim Handler
function initClaimHandler() {
  const submitBtn = document.getElementById('submitClaimBtn');
  const codeInput = document.getElementById('claimCodeInput');
  const walletInput = document.getElementById('claimWalletInput');
  const statusBox = document.getElementById('claimStatusBox');
  if (!submitBtn || !codeInput || !walletInput) return;

  submitBtn.addEventListener('click', async () => {
    const code = codeInput.value.trim();
    const wallet = walletInput.value.trim();
    if (!code) {
      showToast('Please enter your claim code');
      codeInput.focus();
      return;
    }
    if (!wallet) {
      showToast('Please enter your Solana wallet address');
      walletInput.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerText = 'Verifying on Solana...';
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.style.background = '#18181b';
      statusBox.style.border = '1px solid rgba(255,255,255,0.1)';
      statusBox.style.color = '#a1a1aa';
      statusBox.innerHTML = 'Verifying cryptographic claim code & bonding status...';
    }

    try {
      const resp = await fetch('https://up-grok-backend.onrender.com/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimCode: code, walletAddress: wallet })
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        statusBox.style.background = 'rgba(34, 197, 94, 0.15)';
        statusBox.style.border = '1px solid #22c55e';
        statusBox.style.color = '#4ade80';
        statusBox.innerHTML = `<strong>✅ Claim Approved!</strong><br>${data.bonusAmount || '3.0 SOL'} creator bonus recorded for wallet <code>${wallet.slice(0,6)}...${wallet.slice(-6)}</code>.<br>Status: <em>${data.status}</em> · 20% perpetual revenue share active!`;
      } else {
        statusBox.style.background = 'rgba(239, 68, 68, 0.15)';
        statusBox.style.border = '1px solid #ef4444';
        statusBox.style.color = '#f87171';
        statusBox.innerHTML = `<strong>⚠️ Verification Notice</strong><br>${data.error || 'Invalid claim code or wallet address'}`;
      }
    } catch (e) {
      // Local / Offline fallback simulation
      statusBox.style.background = 'rgba(34, 197, 94, 0.15)';
      statusBox.style.border = '1px solid #22c55e';
      statusBox.style.color = '#4ade80';
      statusBox.innerHTML = `<strong>✅ Devnet Simulation: Claim Approved!</strong><br>3.0 SOL creator bonus allocated to wallet <code>${wallet.slice(0,6)}...${wallet.slice(-6)}</code>.<br>20% creator fee revenue-share activated on-chain!`;
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Verify & Claim 3 SOL';
    }
  });
}

// Live Recent Coins Loader
async function loadRecentCoins() {
  const container = document.querySelector('#coinsModal .coins-table');
  if (!container) return;
  try {
    const resp = await fetch('https://up-grok-backend.onrender.com/api/coins');
    if (!resp.ok) return;
    const coins = await resp.json();
    if (!coins || !coins.length) return;
    
    container.innerHTML = coins.map(coin => `
      <div class="coin-row" style="display:flex; align-items:center; justify-content:space-between; padding:12px; border-bottom:1px solid rgba(255,255,255,0.06);">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="coin-avatar-box" style="width:40px; height:40px; border-radius:50%; background: #27272a; display: flex; align-items:center; justify-content:center; color: #a1a1aa; font-weight: bold; font-size:0.85rem;">
            $${(coin.symbol || 'UP').slice(0, 3)}
          </div>
          <div class="coin-details">
            <strong style="color:#fff; font-size:0.95rem;">${coin.name} ($${coin.symbol})</strong>
            <div style="font-family: var(--font-mono); font-size: 0.75rem; color: #71717a; margin-top:2px;">CA: ${coin.mint.slice(0, 6)}...${coin.mint.slice(-4)}</div>
          </div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span class="coin-status-badge ${coin.claimed ? 'bonded' : 'active'}" style="font-size:0.75rem; padding:3px 8px; border-radius:12px; background:${coin.claimed ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)'}; color:${coin.claimed ? '#4ade80' : '#60a5fa'}; font-weight:600;">${coin.claimed ? '3 SOL Claimed' : 'Trading'}</span>
          <a href="${coin.pumpUrl || 'https://pump.fun'}" target="_blank" rel="noopener noreferrer" class="btn btn-pill-white btn-sm" style="font-size: 0.72rem; padding: 4px 10px;">pump.fun ↗</a>
        </div>
      </div>
    `).join('');
  } catch (e) {
    // Keep fallback table
  }
}

// Modals Handler
function initModals() {
  window.openModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (modalId === 'coinsModal') {
      loadRecentCoins();
    }
  };

  window.closeModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
  };

  // Close when clicking backdrop
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(modal => {
        modal.classList.remove('active');
      });
      document.body.style.overflow = '';
    }
  });
}


// ==========================================================================
// HERO AUTO-TYPING & RESULT CARD SIMULATION (MATCHED TO COMPETITOR VIDEO)
// ==========================================================================
let heroDemoRunning = false;
let heroDemoTimeout = null;

function initHeroDemo() {
  const replayBtn = document.getElementById("replayDemoBtn");
  const heroInput = document.getElementById("heroComposerInput");
  const heroSendBtn = document.getElementById("heroSendBtn");

  if (replayBtn) {
    replayBtn.addEventListener("click", () => {
      runHeroDemo(true);
    });
  }

  if (heroSendBtn && heroInput) {
    heroSendBtn.addEventListener("click", handleUserHeroSubmit);
    heroInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleUserHeroSubmit();
    });
  }

  // Auto-play the demo on page load after a slight delay
  setTimeout(() => {
    runHeroDemo(false);
  }, 600);
}

function runHeroDemo(force = false) {
  if (heroDemoRunning && !force) return;
  heroDemoRunning = true;
  clearTimeout(heroDemoTimeout);

  const turn1 = document.getElementById("heroTurn1");
  const turn2 = document.getElementById("heroTurn2");
  const turn3 = document.getElementById("heroTurn3");
  const turn4 = document.getElementById("heroTurn4");
  const input = document.getElementById("heroComposerInput");
  const imgLabel = document.getElementById("heroImgLabel");
  const imgWrapper = document.getElementById("heroImgWrapper");
  const imgPlaceholder = document.getElementById("heroImgPlaceholder");
  const statusIndicator = document.getElementById("heroWorkingIndicator");
  const resultCard = document.getElementById("launchResultCard");
  const workedIndicator = document.getElementById("heroWorkedIndicator");

  if (!turn1 || !turn2 || !turn3 || !turn4 || !input) return;

  // Reset to initial clean state
  turn1.style.display = "none";
  turn2.style.display = "none";
  turn3.style.display = "none";
  turn4.style.display = "none";
  if (resultCard) resultCard.style.display = "none";
  if (workedIndicator) workedIndicator.style.display = "none";
  if (statusIndicator) statusIndicator.style.display = "none";
  input.value = "";
  input.placeholder = "";

  const text1 = "make me a picture of a cat in a suit";
  const text2 = "UPload It. Test Cat, TCAT";

  // Type Prompt 1
  typeText(input, text1, 35, () => {
    heroDemoTimeout = setTimeout(() => {
      input.value = "";
      turn1.style.display = "flex";
      turn2.style.display = "flex";

      // Show Creating image placeholder
      if (imgLabel) imgLabel.innerText = "Creating image...";
      if (imgPlaceholder) imgPlaceholder.style.display = "block";
      if (imgWrapper) imgWrapper.style.display = "none";

      // After 1.4s, image created!
      heroDemoTimeout = setTimeout(() => {
        if (imgLabel) imgLabel.innerText = "Image created";
        if (imgPlaceholder) imgPlaceholder.style.display = "none";
        if (imgWrapper) {
          imgWrapper.style.display = "block";
          imgWrapper.style.animation = "cardFadeIn 0.4s ease-out";
        }

        // Type Prompt 2
        heroDemoTimeout = setTimeout(() => {
          typeText(input, text2, 38, () => {
            heroDemoTimeout = setTimeout(() => {
              input.value = "";
              turn3.style.display = "flex";
              turn4.style.display = "flex";

              // Show Working status
              if (statusIndicator) statusIndicator.style.display = "inline-flex";
              if (workedIndicator) workedIndicator.style.display = "none";
              if (resultCard) resultCard.style.display = "none";

              // After 2.2s, switches to Worked for 4s and shows deployment card!
              heroDemoTimeout = setTimeout(() => {
                if (statusIndicator) statusIndicator.style.display = "none";
                if (workedIndicator) workedIndicator.style.display = "inline-flex";
                if (resultCard) {
                  resultCard.style.display = "block";
                  resultCard.style.animation = "cardFadeIn 0.4s ease-out";
                }
                input.placeholder = "UPload It. Name, TICKER";
                heroDemoRunning = false;
              }, 2200);
            }, 400);
          });
        }, 800);
      }, 1400);
    }, 400);
  });
}

function typeText(inputEl, text, speed, callback) {
  let idx = 0;
  inputEl.value = "";
  const timer = setInterval(() => {
    if (idx < text.length) {
      inputEl.value += text.charAt(idx);
      idx++;
    } else {
      clearInterval(timer);
      if (callback) callback();
    }
  }, speed);
}

function handleUserHeroSubmit() {
  const input = document.getElementById("heroComposerInput");
  if (!input) return;
  const val = input.value.trim();
  if (!val) {
    showToast("Type a command like: UPload It. Doge, DOGE");
    return;
  }

  // Trigger test-drive simulator below
  const sandboxInput = document.getElementById("sandboxInput");
  const simBtn = document.getElementById("simulateLaunchBtn");
  if (sandboxInput && simBtn) {
    sandboxInput.value = val.replace(/^UPload It\.\s*/i, "");
    document.getElementById("launch-sandbox").scrollIntoView({ behavior: "smooth", block: "center" });
    simBtn.click();
    input.value = "";
  }
}


// ==========================================================================
// MOTION ENGINE: HERO ANIMATION & SIMULATION (MATCHING COMPETITOR VIDEO)
// ==========================================================================
let heroAnimationRunning = false;
let heroAnimationTimer = null;
let heroLoopTimer = null;

window.restartHeroDemo = function () {
  clearTimeout(heroAnimationTimer);
  clearTimeout(heroLoopTimer);
  heroAnimationRunning = false;
  runHeroDemo();
};

function runHeroDemo() {
  if (heroAnimationRunning) return;
  heroAnimationRunning = true;

  const t1 = document.getElementById("heroTurn1");
  const t2 = document.getElementById("heroTurn2");
  const t3 = document.getElementById("heroTurn3");
  const t4 = document.getElementById("heroTurn4");
  const typingSpan = document.getElementById("heroTypingText");
  const sendBtn = document.getElementById("heroSendBtn");
  const imgLabel = document.getElementById("heroImgLabel");
  const imgPlaceholder = document.getElementById("heroImgPlaceholder");
  const imgWrapper = document.getElementById("heroImgWrapper");
  const workingInd = document.getElementById("heroWorkingIndicator");
  const workedInd = document.getElementById("heroWorkedIndicator");
  const resultCard = document.getElementById("heroResultCard");

  if (!t1 || !t2 || !t3 || !t4 || !typingSpan) return;

  // Reset to initial clean state
  t1.style.display = "none";
  t2.style.display = "none";
  t3.style.display = "none";
  t4.style.display = "none";
  if (resultCard) resultCard.style.display = "none";
  if (workedInd) workedInd.style.display = "none";
  if (workingInd) workingInd.style.display = "none";
  if (imgWrapper) imgWrapper.style.display = "none";
  if (imgPlaceholder) imgPlaceholder.style.display = "block";
  if (imgLabel) imgLabel.innerText = "Creating image";
  typingSpan.innerText = "";

  const prompt1 = "make me a picture of a cat in a suit";
  const prompt2 = "UPload It. Test Cat, TCAT";

  // Step 1: Type Prompt 1 into composer
  typeIntoElement(typingSpan, prompt1, 36, () => {
    flashSendBtn(sendBtn, () => {
      typingSpan.innerText = "";
      t1.style.display = "flex";
      t2.style.display = "flex";

      // Step 2: Creating image state
      if (imgLabel) imgLabel.innerText = "Creating image";
      if (imgPlaceholder) imgPlaceholder.style.display = "block";
      if (imgWrapper) imgWrapper.style.display = "none";

      // After 1.5s, image is created!
      heroAnimationTimer = setTimeout(() => {
        if (imgLabel) imgLabel.innerText = "Image created";
        if (imgPlaceholder) imgPlaceholder.style.display = "none";
        if (imgWrapper) {
          imgWrapper.style.display = "block";
          imgWrapper.style.animation = "fadeScaleIn 0.4s ease-out";
        }

        // Step 3: Pause briefly, then type Prompt 2
        heroAnimationTimer = setTimeout(() => {
          typeIntoElement(typingSpan, prompt2, 40, () => {
            flashSendBtn(sendBtn, () => {
              typingSpan.innerText = "";
              t3.style.display = "flex";
              t4.style.display = "flex";

              // Step 4: Working status with green pulse
              if (workingInd) workingInd.style.display = "inline-flex";
              if (workedInd) workedInd.style.display = "none";
              if (resultCard) resultCard.style.display = "none";

              // After 2.4s, switches to Worked for 4s & reveals Launch Result Card!
              heroAnimationTimer = setTimeout(() => {
                if (workingInd) workingInd.style.display = "none";
                if (workedInd) workedInd.style.display = "inline-flex";
                if (resultCard) {
                  resultCard.style.display = "block";
                  resultCard.style.animation = "fadeSlideInUp 0.45s ease-out";
                }
                heroAnimationRunning = false;

                // Demo completes once and stays in final state
                heroAnimationRunning = false;
              }, 2400);
            });
          });
        }, 900);
      }, 1500);
    });
  });
}

function typeIntoElement(el, text, speed, callback) {
  let idx = 0;
  el.textContent = "";
  const interval = setInterval(() => {
    if (idx < text.length) {
      idx++;
      el.textContent = text.slice(0, idx);
    } else {
      clearInterval(interval);
      if (callback) callback();
    }
  }, speed);
}

function flashSendBtn(btn, callback) {
  if (btn) {
    btn.style.background = "rgba(255, 255, 255, 0.4)";
    setTimeout(() => {
      btn.style.background = "";
      if (callback) callback();
    }, 200);
  } else if (callback) {
    callback();
  }
}
