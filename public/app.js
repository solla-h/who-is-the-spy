/**
 * 谁是卧底 - Who is the Spy
 * Frontend Application
 */

// ========================================
// Page Router
// ========================================

/**
 * PageRouter handles URL hash-based routing and page transitions
 */
class PageRouter {
  constructor() {
    /** @type {string} */
    this.currentPage = 'home';

    /** @type {Object} */
    this.params = {};

    /** @type {Map<string, HTMLElement>} */
    this.pages = new Map();

    /** @type {Array<Function>} */
    this.listeners = [];

    this._init();
  }

  /**
   * Initialize the router
   * @private
   */
  _init() {
    // Cache all page elements
    document.querySelectorAll('.page').forEach(page => {
      const id = page.id.replace('page-', '');
      this.pages.set(id, page);
    });

    // Listen for hash changes
    window.addEventListener('hashchange', () => this._handleHashChange());

    // Handle initial route
    this._handleHashChange();

    // Setup back button handlers (support both old and new class names)
    document.querySelectorAll('.btn-back, .btn-nav-back').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.dataset.back || 'home';
        this.navigate(target);
      });
    });
  }

  /**
   * Handle hash change events
   * @private
   */
  _handleHashChange() {
    const hash = window.location.hash.slice(1) || 'home';
    const [page, queryString] = hash.split('?');

    // Parse query parameters
    this.params = {};
    if (queryString) {
      queryString.split('&').forEach(param => {
        const [key, value] = param.split('=');
        this.params[decodeURIComponent(key)] = decodeURIComponent(value || '');
      });
    }

    this._showPage(page);
  }

  /**
   * Show a specific page
   * @private
   * @param {string} pageName - Name of the page to show
   */
  _showPage(pageName) {
    // Validate page exists
    if (!this.pages.has(pageName)) {
      console.warn(`Page "${pageName}" not found, redirecting to home`);
      pageName = 'home';
    }

    // Protected routes check
    if (['waiting', 'game'].includes(pageName)) {
      const session = loadSession();
      if (!session.token || !session.roomId) {
        console.warn(`Access to ${pageName} denied: No active session`);
        // If we're not already redirecting, redirect to home
        if (this.currentPage !== 'home') {
          setTimeout(() => this.navigate('home'), 0);
        }
        return;
      }
    }

    const previousPage = this.currentPage;
    this.currentPage = pageName;

    // Hide all pages
    this.pages.forEach((element, name) => {
      if (name === pageName) {
        element.classList.remove('hidden');
      } else {
        element.classList.add('hidden');
      }
    });

    // Notify listeners
    this.listeners.forEach(callback => {
      callback(pageName, previousPage, this.params);
    });
  }

  /**
   * Navigate to a page
   * @param {string} page - Page name to navigate to
   * @param {Object} [params] - Optional query parameters
   */
  navigate(page, params = {}) {
    let hash = page;

    // Build query string
    const queryParts = Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);

    if (queryParts.length > 0) {
      hash += '?' + queryParts.join('&');
    }

    window.location.hash = hash;
  }

  /**
   * Get current page name
   * @returns {string}
   */
  getCurrentPage() {
    return this.currentPage;
  }

  /**
   * Get current route parameters
   * @returns {Object}
   */
  getParams() {
    return { ...this.params };
  }

  /**
   * Add a page change listener
   * @param {Function} callback - Callback function(currentPage, previousPage, params)
   */
  onPageChange(callback) {
    this.listeners.push(callback);
  }

  /**
   * Remove a page change listener
   * @param {Function} callback - Callback to remove
   */
  offPageChange(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }
}


// ========================================
// API Client
// ========================================

/**
 * Error codes from the backend API
 * @enum {string}
 */
const ErrorCode = {
  INVALID_INPUT: 'INVALID_INPUT',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  WRONG_PASSWORD: 'WRONG_PASSWORD',
  GAME_IN_PROGRESS: 'GAME_IN_PROGRESS',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  INVALID_ACTION: 'INVALID_ACTION',
  PLAYER_NOT_FOUND: 'PLAYER_NOT_FOUND',
  DUPLICATE_NAME: 'DUPLICATE_NAME',
  INVALID_PHASE: 'INVALID_PHASE',
  DATABASE_ERROR: 'DATABASE_ERROR'
};

/**
 * ApiClient handles all API communication with the backend
 * Implements Requirements 9.3, 9.4 - Token management and state restoration
 */
class ApiClient {
  constructor() {
    /** @type {string} */
    this.baseUrl = '';
  }

  /**
   * Make an API request with error handling
   * @private
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - API response
   */
  async _request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const mergedOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, mergedOptions);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API request error:', error);
      return {
        success: false,
        error: '网络错误，请检查连接',
        code: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Create a new game room
   * @param {string} playerName - Player display name (2-10 characters)
   * @returns {Promise<{success: boolean, roomCode?: string, roomId?: string, roomPassword?: string, playerToken?: string, error?: string, code?: string}>}
   */
  async createRoom(playerName) {
    return this._request('/api/room/create', {
      method: 'POST',
      body: JSON.stringify({ playerName })
    });
  }

  /**
   * Join an existing room
   * @param {string} roomCode - 6-digit room code
   * @param {string} password - Room password
   * @param {string} playerName - Player display name
   * @param {string} [playerToken] - Optional token for reconnection
   * @returns {Promise<{success: boolean, roomId?: string, playerToken?: string, isReconnect?: boolean, error?: string, code?: string}>}
   */
  async joinRoom(roomCode, password, playerName, playerToken = null) {
    const body = { roomCode, password, playerName };
    if (playerToken) {
      body.playerToken = playerToken;
    }

    return this._request('/api/room/join', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * Get current room state
   * @param {string} roomId - Room ID
   * @param {string} token - Player token
   * @returns {Promise<{success: boolean, roomId?: string, roomCode?: string, phase?: string, players?: Array, currentTurn?: number, round?: number, descriptions?: Array, votes?: Array, result?: Object, settings?: Object, myWord?: string, myRole?: string, isHost?: boolean, error?: string, code?: string}>}
   */
  async getRoomState(roomId, token) {
    return this._request(`/api/room/${roomId}/state?token=${encodeURIComponent(token)}`);
  }

  /**
   * Perform a game action
   * @param {string} roomId - Room ID
   * @param {string} token - Player token
   * @param {Object} action - Action object with type and optional parameters
   * @returns {Promise<{success: boolean, error?: string, code?: string}>}
   */
  async performAction(roomId, token, action) {
    return this._request(`/api/room/${roomId}/action`, {
      method: 'POST',
      body: JSON.stringify({ token, action })
    });
  }

  // ========================================
  // Convenience methods for specific actions
  // ========================================

  /**
   * Start the game (host only)
   * @param {string} roomId - Room ID
   * @param {string} token - Player token
   * @returns {Promise<{success: boolean, error?: string, code?: string}>}
   */
  async startGame(roomId, token) {
    return this.performAction(roomId, token, { type: 'start-game' });
  }

  /**
   * Confirm word viewing (host only - starts description phase)
   * @param {string} roomId - Room ID
   * @param {string} token - Player token
   * @returns {Promise<{success: boolean, error?: string, code?: string}>}
   */
  async confirmWord(roomId, token) {
    return this.performAction(roomId, token, { type: 'confirm-word' });
  }

  /**
   * Player confirms they have seen their word (non-host players)
   * @param {string} roomId - Room ID
   * @param {string} token - Player token
   * @returns {Promise<{success: boolean, error?: string, code?: string}>}
   */
  async confirmWordPlayer(roomId, token) {
    return this.performAction(roomId, token, { type: 'confirm-word-player' });
  }

  /**
   * Submit a description
   * @param {string} roomId - Room ID
   * @param {string} token - Player token
   * @param {string} text - Description text (2-50 characters)
   * @returns {Promise<{success: boolean, error?: string, code?: string}>}
   */
  async submitDescription(roomId, token, text) {
    return this.performAction(roomId, token, { type: 'submit-description', text });
  }

  /**
   * Skip to next player (host only)
   * @param {string} roomId - Room ID
   * @param {string} token - Player token
   * @returns {Promise<{success: boolean, error?: string, code?: string}>}
   */
  async nextPlayer(roomId, token) {
    return this.performAction(roomId, token, { type: 'next-player' });
  }

  /**
   * Start voting phase (host only)
   * @param {string} roomId - Room ID
   * @param {string} token - Player token
   * @returns {Promise<{success: boolean, error?: string, code?: string}>}
   */
  async startVoting(roomId, token) {
    return this.performAction(roomId, token, { type: 'start-voting' });
  }

  /**
   * Submit a vote
   * @param {string} roomId - Room ID
   * @param {string} token - Player token
   * @param {string} targetId - ID of player to vote for
   * @returns {Promise<{success: boolean, error?: string, code?: string}>}
   */
  async vote(roomId, token, targetId) {
    return this.performAction(roomId, token, { type: 'vote', targetId });
  }

  /**
   * Finalize voting and tally results (host only)
   * @param {string} roomId - Room ID
   * @param {string} token - Player token
   * @returns {Promise<{success: boolean, error?: string, code?: string}>}
   */
  async finalizeVoting(roomId, token) {
    return this.performAction(roomId, token, { type: 'finalize-voting' });
  }

  /**
   * Continue game after result phase
   * @param {string} roomId - Room ID
   * @param {string} token - Player token
   * @returns {Promise<{success: boolean, error?: string, code?: string}>}
   */
  async continueGame(roomId, token) {
    return this.performAction(roomId, token, { type: 'continue-game' });
  }

  /**
   * Restart the game (host only)
   * @param {string} roomId - Room ID
   * @param {string} token - Player token
   * @returns {Promise<{success: boolean, error?: string, code?: string}>}
   */
  async restartGame(roomId, token) {
    return this.performAction(roomId, token, { type: 'restart-game' });
  }

  /**
   * Update game settings (host only)
   * @param {string} roomId - Room ID
   * @param {string} token - Player token
   * @param {Object} settings - Settings to update
   * @returns {Promise<{success: boolean, error?: string, code?: string}>}
   */
  async updateSettings(roomId, token, settings) {
    return this.performAction(roomId, token, { type: 'update-settings', settings });
  }

  /**
   * Kick a player from the room (host only)
   * @param {string} roomId - Room ID
   * @param {string} token - Player token
   * @param {string} playerId - ID of player to kick
   * @returns {Promise<{success: boolean, error?: string, code?: string}>}
   */
  async kickPlayer(roomId, token, playerId) {
    return this.performAction(roomId, token, { type: 'kick-player', playerId });
  }

  /**
   * Get user-friendly error message from error code
   * @param {string} code - Error code
   * @param {string} [defaultMessage] - Default message if code not recognized
   * @returns {string} - User-friendly error message
   */
  getErrorMessage(code, defaultMessage = '操作失败，请重试') {
    const messages = {
      [ErrorCode.INVALID_INPUT]: '输入格式不正确',
      [ErrorCode.ROOM_NOT_FOUND]: '房间不存在或已关闭',
      [ErrorCode.WRONG_PASSWORD]: '密码错误',
      [ErrorCode.GAME_IN_PROGRESS]: '游戏已开始，无法加入',
      [ErrorCode.NOT_AUTHORIZED]: '只有房主可以执行此操作',
      [ErrorCode.INVALID_ACTION]: '当前状态不允许此操作',
      [ErrorCode.PLAYER_NOT_FOUND]: '玩家不存在',
      [ErrorCode.DUPLICATE_NAME]: '该昵称已被使用',
      [ErrorCode.INVALID_PHASE]: '当前游戏阶段不允许此操作',
      [ErrorCode.DATABASE_ERROR]: '服务器错误，请稍后重试',
      'NETWORK_ERROR': '网络错误，请检查连接'
    };

    return messages[code] || defaultMessage;
  }
}


// ========================================
// Game State Manager
// ========================================

/**
 * GameStateManager handles game state polling and change detection
 * Implements Requirements 9.1, 9.2 - Real-time state synchronization
 */
class GameStateManager {
  /**
   * @param {ApiClient} apiClient - API client instance
   */
  constructor(apiClient) {
    /** @type {ApiClient} */
    this.apiClient = apiClient;

    /** @type {Object|null} */
    this.roomState = null;

    /** @type {string|null} */
    this.roomId = null;

    /** @type {string|null} */
    this.token = null;

    /** @type {number|null} */
    this.pollingInterval = null;

    /** @type {number} */
    this.pollIntervalMs = 2000; // 2 seconds as per requirements

    /** @type {Array<Function>} */
    this.stateChangeListeners = [];

    /** @type {Array<Function>} */
    this.connectionListeners = [];

    /** @type {boolean} */
    this.isConnected = true;

    /** @type {number} */
    this.consecutiveErrors = 0;

    /** @type {number} */
    this.maxConsecutiveErrors = 3;

    /** @type {boolean} */
    this.isPolling = false;
  }

  /**
   * Start polling for room state updates
   * @param {string} roomId - Room ID to poll
   * @param {string} token - Player token for authentication
   */
  startPolling(roomId, token) {
    // Stop any existing polling
    this.stopPolling();

    this.roomId = roomId;
    this.token = token;
    this.isPolling = true;
    this.consecutiveErrors = 0;

    // Fetch initial state immediately
    this._poll();

    // Start polling interval
    this.pollingInterval = setInterval(() => {
      this._poll();
    }, this.pollIntervalMs);
  }

  /**
   * Stop polling for updates
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    this.roomId = null;
    this.token = null;
    this.roomState = null;
  }

  /**
   * Perform a single poll for state
   * @private
   */
  async _poll() {
    if (!this.roomId || !this.token) {
      return;
    }

    try {
      const result = await this.apiClient.getRoomState(this.roomId, this.token);

      if (result.success) {
        this.consecutiveErrors = 0;
        this._updateConnectionStatus(true);
        this._handleStateUpdate(result);
      } else {
        this.consecutiveErrors++;

        // Handle specific error codes
        if (result.code === ErrorCode.ROOM_NOT_FOUND || result.code === ErrorCode.PLAYER_NOT_FOUND) {
          // If we encounter "not found" errors, only treat as fatal after max retries
          // This handles eventual consistency where room might not be visible immediately
          if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
            this.stopPolling();
            this._notifyStateChange(null, 'room_closed');
            return;
          }
        }

        // Check for disconnect threshold
        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
          this._updateConnectionStatus(false);
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
      this.consecutiveErrors++;

      if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
        this._updateConnectionStatus(false);
      }
    }
  }

  /**
   * Handle state update from API
   * @private
   * @param {Object} result - API result containing state
   */
  _handleStateUpdate(result) {
    // Extract the actual state from the API response
    // API returns { success: true, state: { phase, players, ... } }
    const newState = result.state || result;
    const previousState = this.roomState;
    const hasChanged = this._hasStateChanged(previousState, newState);

    this.roomState = newState;

    if (hasChanged) {
      this._notifyStateChange(newState, 'update');
    }
  }

  /**
   * Check if state has meaningfully changed
   * @private
   * @param {Object|null} oldState - Previous state
   * @param {Object} newState - New state
   * @returns {boolean} - True if state has changed
   */
  _hasStateChanged(oldState, newState) {
    if (!oldState) {
      return true;
    }

    // Compare key fields that indicate meaningful changes
    if (oldState.phase !== newState.phase) return true;
    if (oldState.currentTurn !== newState.currentTurn) return true;
    if (oldState.round !== newState.round) return true;

    // Compare player count and status
    if (oldState.players?.length !== newState.players?.length) return true;

    // Check for player status changes
    if (oldState.players && newState.players) {
      for (let i = 0; i < newState.players.length; i++) {
        const oldPlayer = oldState.players.find(p => p.id === newState.players[i].id);
        const newPlayer = newState.players[i];

        if (!oldPlayer) return true;
        if (oldPlayer.isAlive !== newPlayer.isAlive) return true;
        if (oldPlayer.isOnline !== newPlayer.isOnline) return true;
        if (oldPlayer.hasVoted !== newPlayer.hasVoted) return true;
        if (oldPlayer.hasDescribed !== newPlayer.hasDescribed) return true;
        if (oldPlayer.hasConfirmedWord !== newPlayer.hasConfirmedWord) return true;
      }
    }

    // Check descriptions count
    if (oldState.descriptions?.length !== newState.descriptions?.length) return true;

    // Check votes count
    if (oldState.votes?.length !== newState.votes?.length) return true;

    // Check result changes
    if (JSON.stringify(oldState.result) !== JSON.stringify(newState.result)) return true;

    return false;
  }

  /**
   * Update connection status and notify listeners
   * @private
   * @param {boolean} connected - New connection status
   */
  _updateConnectionStatus(connected) {
    if (this.isConnected !== connected) {
      this.isConnected = connected;
      this.connectionListeners.forEach(callback => {
        try {
          callback(connected);
        } catch (error) {
          console.error('Connection listener error:', error);
        }
      });
    }
  }

  /**
   * Notify state change listeners
   * @private
   * @param {Object|null} state - New state
   * @param {string} reason - Reason for notification ('update', 'room_closed')
   */
  _notifyStateChange(state, reason) {
    this.stateChangeListeners.forEach(callback => {
      try {
        callback(state, reason);
      } catch (error) {
        console.error('State change listener error:', error);
      }
    });
  }

  /**
   * Add a state change listener
   * @param {Function} callback - Callback function(state, reason)
   */
  onStateChange(callback) {
    this.stateChangeListeners.push(callback);
  }

  /**
   * Remove a state change listener
   * @param {Function} callback - Callback to remove
   */
  offStateChange(callback) {
    const index = this.stateChangeListeners.indexOf(callback);
    if (index > -1) {
      this.stateChangeListeners.splice(index, 1);
    }
  }

  /**
   * Add a connection status listener
   * @param {Function} callback - Callback function(isConnected)
   */
  onConnectionChange(callback) {
    this.connectionListeners.push(callback);
  }

  /**
   * Remove a connection status listener
   * @param {Function} callback - Callback to remove
   */
  offConnectionChange(callback) {
    const index = this.connectionListeners.indexOf(callback);
    if (index > -1) {
      this.connectionListeners.splice(index, 1);
    }
  }

  /**
   * Get current room state
   * @returns {Object|null} - Current room state or null
   */
  getState() {
    return this.roomState;
  }

  /**
   * Check if currently connected
   * @returns {boolean} - Connection status
   */
  getConnectionStatus() {
    return this.isConnected;
  }

  /**
   * Force an immediate state refresh
   * @returns {Promise<Object|null>} - Updated state or null on error
   */
  async refresh() {
    if (!this.roomId || !this.token) {
      return null;
    }

    await this._poll();
    return this.roomState;
  }
}


// ========================================
// UI Utilities
// ========================================

/**
 * Toast notification icons for different types
 * @type {Object<string, string>}
 */
const TOAST_ICONS = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠'
};

/**
 * Show a toast notification
 * Requirements: 14.2 - Clear visual feedback for all user actions
 * @param {string} message - Message to display
 * @param {'success' | 'error' | 'info' | 'warning'} [type='info'] - Toast type
 * @param {number} [duration=3000] - Duration in milliseconds (0 for no auto-dismiss)
 */
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Limit maximum number of toasts to prevent overflow
  const maxToasts = 5;
  const existingToasts = container.querySelectorAll('.toast:not(.fade-out)');
  if (existingToasts.length >= maxToasts) {
    // Remove oldest toast
    const oldestToast = existingToasts[0];
    dismissToast(oldestToast);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.style.position = 'relative';
  toast.style.overflow = 'hidden';

  // Create toast content with icon
  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.textContent = TOAST_ICONS[type] || TOAST_ICONS.info;

  const messageSpan = document.createElement('span');
  messageSpan.className = 'toast-message';
  messageSpan.textContent = message;

  const closeBtn = document.createElement('span');
  closeBtn.className = 'toast-close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', '关闭');

  toast.appendChild(icon);
  toast.appendChild(messageSpan);
  toast.appendChild(closeBtn);

  // Add progress bar for auto-dismiss
  if (duration > 0) {
    const progress = document.createElement('div');
    progress.className = 'toast-progress';
    progress.style.animationDuration = `${duration}ms`;
    toast.appendChild(progress);
  }

  container.appendChild(toast);

  // Click to dismiss
  toast.addEventListener('click', () => dismissToast(toast));

  // Auto remove after duration
  if (duration > 0) {
    setTimeout(() => {
      dismissToast(toast);
    }, duration);
  }

  return toast;
}

/**
 * Dismiss a toast notification with animation
 * @param {HTMLElement} toast - Toast element to dismiss
 */
function dismissToast(toast) {
  if (!toast || toast.classList.contains('fade-out')) return;

  toast.classList.add('fade-out');
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 250);
}

/**
 * Clear all toast notifications
 */
function clearAllToasts() {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toasts = container.querySelectorAll('.toast');
  toasts.forEach(toast => dismissToast(toast));
}

/**
 * Show a confirmation dialog
 * Requirements: 8.6, 15.2 - Confirmation for restart game and kick player
 * @param {string} message - Message to display
 * @param {Object} [options] - Dialog options
 * @param {string} [options.title] - Dialog title (default: '确认操作')
 * @param {string} [options.type] - Dialog type: 'warning', 'danger', 'info' (default: 'warning')
 * @param {string} [options.confirmText] - Confirm button text (default: '确认')
 * @param {string} [options.cancelText] - Cancel button text (default: '取消')
 * @param {boolean} [options.confirmDanger] - Use danger style for confirm button
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
function showConfirmDialog(message, options = {}) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirm-dialog');
    const dialogBox = overlay?.querySelector('.dialog-box');
    const iconEl = document.getElementById('confirm-icon');
    const titleEl = document.getElementById('confirm-title');
    const messageEl = document.getElementById('confirm-message');
    const cancelBtn = document.getElementById('confirm-cancel');
    const okBtn = document.getElementById('confirm-ok');

    if (!overlay || !messageEl || !cancelBtn || !okBtn) {
      // Fallback to native confirm if dialog elements not found
      resolve(window.confirm(message));
      return;
    }

    // Set dialog content
    const {
      title = '确认操作',
      type = 'warning',
      confirmText = '确认',
      cancelText = '取消',
      confirmDanger = false
    } = options;

    // Set icon based on type
    const icons = {
      warning: '⚠',
      danger: '⚠',
      info: 'ℹ'
    };

    if (iconEl) {
      iconEl.textContent = icons[type] || icons.warning;
      iconEl.className = `dialog-icon ${type}`;
    }

    if (titleEl) {
      titleEl.textContent = title;
    }

    messageEl.textContent = message;
    cancelBtn.textContent = cancelText;
    okBtn.textContent = confirmText;

    // Set dialog box variant
    if (dialogBox) {
      dialogBox.className = `dialog-box ${type === 'danger' ? 'danger' : ''}`;
    }

    // Set confirm button style
    okBtn.className = confirmDanger ? 'btn btn-danger' : 'btn btn-primary';

    overlay.classList.remove('hidden');

    // Focus the cancel button for safety (user must actively choose to confirm)
    cancelBtn.focus();

    const cleanup = () => {
      overlay.classList.add('hidden');
      cancelBtn.removeEventListener('click', handleCancel);
      okBtn.removeEventListener('click', handleOk);
      document.removeEventListener('keydown', handleKeydown);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const handleOk = () => {
      cleanup();
      resolve(true);
    };

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter') {
        // Only confirm on Enter if OK button is focused
        if (document.activeElement === okBtn) {
          handleOk();
        }
      }
    };

    cancelBtn.addEventListener('click', handleCancel);
    okBtn.addEventListener('click', handleOk);
    document.addEventListener('keydown', handleKeydown);
  });
}

/**
 * Show a restart game confirmation dialog
 * Requirements: 8.6 - Confirmation dialog with "确认重新开始？" message
 * @returns {Promise<boolean>}
 */
function showRestartConfirmDialog() {
  return showConfirmDialog('所有游戏进度将被清除，确定要重新开始吗？', {
    title: '确认重新开始？',
    type: 'warning',
    confirmText: '重新开始',
    cancelText: '取消',
    confirmDanger: true
  });
}

/**
 * Show a kick player confirmation dialog
 * Requirements: 15.2 - Confirmation for kicking players
 * @param {string} playerName - Name of the player to kick
 * @returns {Promise<boolean>}
 */
function showKickConfirmDialog(playerName) {
  return showConfirmDialog(`确定要将 "${playerName}" 踢出房间吗？`, {
    title: '踢出玩家',
    type: 'danger',
    confirmText: '踢出',
    cancelText: '取消',
    confirmDanger: true
  });
}

/**
 * Set button loading state
 * Requirements: 14.2 - Clear visual feedback for all user actions
 * @param {HTMLButtonElement} button - Button element
 * @param {boolean} loading - Loading state
 * @param {Object} [options] - Options
 * @param {boolean} [options.inline] - Use inline loading style (preserves text)
 */
function setButtonLoading(button, loading, options = {}) {
  if (!button) return;

  const { inline = false } = options;
  const loadingClass = inline ? 'loading-inline' : 'loading';

  if (loading) {
    button.classList.add(loadingClass);
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  } else {
    button.classList.remove('loading', 'loading-inline');
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

/**
 * Show page loading indicator
 * @param {string} [message='加载中...'] - Loading message
 */
function showPageLoader(message = '加载中...') {
  const loader = document.getElementById('page-loader');
  const loaderText = loader?.querySelector('.loader-text');

  if (loader) {
    if (loaderText) {
      loaderText.textContent = message;
    }
    loader.classList.remove('hidden', 'fade-out');
  }
}

/**
 * Hide page loading indicator
 * @param {boolean} [animate=true] - Whether to animate the hide
 */
function hidePageLoader(animate = true) {
  const loader = document.getElementById('page-loader');

  if (loader) {
    if (animate) {
      loader.classList.add('fade-out');
      setTimeout(() => {
        loader.classList.add('hidden');
        loader.classList.remove('fade-out');
      }, 250);
    } else {
      loader.classList.add('hidden');
    }
  }
}

/**
 * Create a loading spinner element
 * @param {string} [size='medium'] - Size: 'small', 'medium', 'large'
 * @returns {HTMLElement} - Spinner element
 */
function createLoadingSpinner(size = 'medium') {
  const spinner = document.createElement('span');
  spinner.className = 'loading-spinner';
  if (size === 'small') spinner.classList.add('small');
  if (size === 'large') spinner.classList.add('large');
  return spinner;
}

/**
 * Show loading overlay on an element
 * @param {HTMLElement} element - Element to show overlay on
 * @returns {HTMLElement} - The overlay element
 */
function showLoadingOverlay(element) {
  if (!element) return null;

  // Ensure element has position for overlay
  const position = window.getComputedStyle(element).position;
  if (position === 'static') {
    element.style.position = 'relative';
  }

  // Check if overlay already exists
  let overlay = element.querySelector('.loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.appendChild(createLoadingSpinner('large'));
    element.appendChild(overlay);
  }

  overlay.classList.remove('hidden');
  return overlay;
}

/**
 * Hide loading overlay on an element
 * @param {HTMLElement} element - Element to hide overlay on
 */
function hideLoadingOverlay(element) {
  if (!element) return;

  const overlay = element.querySelector('.loading-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - Success status
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch (e) {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

// ========================================
// Application State
// ========================================

/** @type {PageRouter} */
let router;

/** @type {ApiClient} */
let apiClient;

/** @type {GameStateManager} */
let gameStateManager;

/** @type {string|null} */
let playerToken = null;

/** @type {string|null} */
let currentRoomId = null;

/** @type {string|null} */
let currentRoomCode = null;

/** @type {string|null} */
let currentRoomPassword = null;

// ========================================
// Storage Helpers
// ========================================

const STORAGE_KEY_TOKEN = 'who-is-spy-token';
const STORAGE_KEY_ROOM = 'who-is-spy-room';

/**
 * Save player session to localStorage
 * @param {string} token - Player token
 * @param {string} roomId - Room ID
 * @param {string} roomCode - Room code
 * @param {string} [roomPassword] - Room password (optional, only for host)
 */
function saveSession(token, roomId, roomCode, roomPassword = null) {
  playerToken = token;
  currentRoomId = roomId;
  currentRoomCode = roomCode;
  currentRoomPassword = roomPassword;

  localStorage.setItem(STORAGE_KEY_TOKEN, token);
  localStorage.setItem(STORAGE_KEY_ROOM, JSON.stringify({ roomId, roomCode, roomPassword }));
}

/**
 * Load player session from localStorage
 * @returns {{ token: string|null, roomId: string|null, roomCode: string|null, roomPassword: string|null }}
 */
function loadSession() {
  const token = localStorage.getItem(STORAGE_KEY_TOKEN);
  const roomData = localStorage.getItem(STORAGE_KEY_ROOM);

  if (token && roomData) {
    try {
      const { roomId, roomCode, roomPassword } = JSON.parse(roomData);
      playerToken = token;
      currentRoomId = roomId;
      currentRoomCode = roomCode;
      currentRoomPassword = roomPassword || null;
      return { token, roomId, roomCode, roomPassword: roomPassword || null };
    } catch (e) {
      clearSession();
    }
  }

  return { token: null, roomId: null, roomCode: null, roomPassword: null };
}

/**
 * Clear player session
 */
function clearSession() {
  playerToken = null;
  currentRoomId = null;
  currentRoomCode = null;
  currentRoomPassword = null;

  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_ROOM);
}


// ========================================
// Event Handlers Setup
// ========================================

/**
 * Setup all event handlers
 */
function setupEventHandlers() {
  // Home page buttons
  document.getElementById('btn-create-room')?.addEventListener('click', () => {
    router.navigate('create');
  });

  document.getElementById('btn-join-room')?.addEventListener('click', () => {
    router.navigate('join');
  });

  // Create room form
  document.getElementById('form-create')?.addEventListener('submit', handleCreateRoom);

  // Join room form
  document.getElementById('form-join')?.addEventListener('submit', handleJoinRoom);

  // Copy room code button
  document.getElementById('btn-copy-code')?.addEventListener('click', async () => {
    if (currentRoomCode) {
      const success = await copyToClipboard(currentRoomCode);
      showToast(success ? '房间号已复制' : '复制失败', success ? 'success' : 'error');
    }
  });

  // Copy room password button
  document.getElementById('btn-copy-password')?.addEventListener('click', async () => {
    if (currentRoomPassword) {
      const success = await copyToClipboard(currentRoomPassword);
      showToast(success ? '密码已复制' : '复制失败', success ? 'success' : 'error');
    }
  });

  // Spy count controls
  document.getElementById('spy-decrease')?.addEventListener('click', handleSpyDecrease);
  document.getElementById('spy-increase')?.addEventListener('click', handleSpyIncrease);

  // Start game button
  document.getElementById('btn-start-game')?.addEventListener('click', handleStartGame);

  // Game controls - Word reveal phase
  document.getElementById('btn-confirm-word')?.addEventListener('click', handleConfirmWord);
  document.getElementById('btn-confirm-word-player')?.addEventListener('click', handleConfirmWord);

  // Description phase controls
  document.getElementById('form-description')?.addEventListener('submit', handleSubmitDescription);
  document.getElementById('btn-next-player')?.addEventListener('click', handleNextPlayer);
  document.getElementById('btn-start-voting')?.addEventListener('click', handleStartVoting);

  // Game restart controls
  document.getElementById('btn-restart-game')?.addEventListener('click', handleRestartGame);
  document.getElementById('btn-restart-anytime')?.addEventListener('click', handleRestartGame);

  // Result phase - continue game
  document.getElementById('btn-continue-game')?.addEventListener('click', handleContinueGame);

  // Finalize voting (host only)
  document.getElementById('btn-finalize-voting')?.addEventListener('click', handleFinalizeVoting);
}

/**
 * Handle create room form submission
 * @param {Event} e - Form submit event
 */
async function handleCreateRoom(e) {
  e.preventDefault();

  const nameInput = document.getElementById('create-name');
  const submitBtn = e.target.querySelector('button[type="submit"]');

  const name = nameInput.value.trim();

  // Validate inputs
  if (name.length < 2 || name.length > 10) {
    showToast('昵称需要2-10个字符', 'error');
    return;
  }

  setButtonLoading(submitBtn, true);

  try {
    const data = await apiClient.createRoom(name);

    if (data.success) {
      // Save session with auto-generated password
      saveSession(data.playerToken, data.roomId, data.roomCode, data.roomPassword);
      showToast('房间创建成功', 'success');

      // Start polling for room state with a small delay to handle consistency
      setTimeout(() => {
        gameStateManager.startPolling(data.roomId, data.playerToken);
      }, 500);

      router.navigate('waiting');
    } else {
      showToast(apiClient.getErrorMessage(data.code, data.error), 'error');
    }
  } catch (err) {
    showToast('网络错误，请重试', 'error');
    console.error('Create room error:', err);
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

/**
 * Handle join room form submission
 * @param {Event} e - Form submit event
 */
async function handleJoinRoom(e) {
  e.preventDefault();

  const codeInput = document.getElementById('join-code');
  const passwordInput = document.getElementById('join-password');
  const nameInput = document.getElementById('join-name');
  const submitBtn = e.target.querySelector('button[type="submit"]');

  const roomCode = codeInput.value.trim();
  const password = passwordInput.value;
  const name = nameInput.value.trim();

  // Validate inputs
  if (!/^\d{6}$/.test(roomCode)) {
    showToast('房间号需要6位数字', 'error');
    return;
  }

  if (password.length < 4 || password.length > 8) {
    showToast('密码需要4-8个字符', 'error');
    return;
  }

  if (name.length < 2 || name.length > 10) {
    showToast('昵称需要2-10个字符', 'error');
    return;
  }

  setButtonLoading(submitBtn, true);

  try {
    const data = await apiClient.joinRoom(roomCode, password, name);

    if (data.success) {
      saveSession(data.playerToken, data.roomId, roomCode);
      showToast(data.isReconnect ? '重连成功' : '加入成功', 'success');

      // Start polling for room state
      gameStateManager.startPolling(data.roomId, data.playerToken);

      router.navigate('waiting');
    } else {
      showToast(apiClient.getErrorMessage(data.code, data.error), 'error');
    }
  } catch (err) {
    showToast('网络错误，请重试', 'error');
    console.error('Join room error:', err);
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

/**
 * Handle spy count decrease
 */
async function handleSpyDecrease() {
  const state = gameStateManager.getState();
  if (!state || !state.isHost) return;

  const currentCount = state.settings?.spyCount || 1;
  if (currentCount <= 1) {
    showToast('卧底数量最少为1', 'error');
    return;
  }

  const newCount = currentCount - 1;
  await updateSpyCount(newCount);
}

/**
 * Handle spy count increase
 */
async function handleSpyIncrease() {
  const state = gameStateManager.getState();
  if (!state || !state.isHost) return;

  const currentCount = state.settings?.spyCount || 1;
  const playerCount = state.players?.length || 0;

  // Spy count must be less than total players
  if (currentCount >= playerCount - 1) {
    showToast('卧底数量必须少于玩家总数', 'error');
    return;
  }

  const newCount = currentCount + 1;
  await updateSpyCount(newCount);
}

/**
 * Update spy count via API
 * @param {number} spyCount - New spy count
 */
async function updateSpyCount(spyCount) {
  if (!currentRoomId || !playerToken) return;

  const result = await apiClient.updateSettings(currentRoomId, playerToken, { spyCount });

  if (result.success) {
    // Update display immediately
    const spyCountDisplay = document.getElementById('spy-count-display');
    if (spyCountDisplay) {
      spyCountDisplay.textContent = spyCount;
    }
    // Refresh state
    gameStateManager.refresh();
  } else {
    showToast(apiClient.getErrorMessage(result.code, result.error), 'error');
  }
}

/**
 * Handle start game button click
 */
async function handleStartGame() {
  const state = gameStateManager.getState();
  if (!state || !state.isHost) return;

  const playerCount = state.players?.length || 0;
  const spyCount = state.settings?.spyCount || 1;

  // Validate player count
  if (playerCount < 3) {
    showToast('至少需要3名玩家才能开始游戏', 'error');
    return;
  }

  // Validate spy count
  if (spyCount >= playerCount) {
    showToast('卧底数量必须少于玩家总数', 'error');
    return;
  }

  const startBtn = document.getElementById('btn-start-game');
  if (startBtn) setButtonLoading(startBtn, true);

  try {
    const result = await apiClient.startGame(currentRoomId, playerToken);

    if (result.success) {
      showToast('游戏开始！', 'success');
      gameStateManager.refresh();
    } else {
      showToast(apiClient.getErrorMessage(result.code, result.error), 'error');
    }
  } catch (err) {
    showToast('网络错误，请重试', 'error');
    console.error('Start game error:', err);
  } finally {
    if (startBtn) setButtonLoading(startBtn, false);
  }
}

/**
 * Handle kick player button click
 * Requirements: 15.2, 15.4 - Kick player with confirmation
 * @param {string} playerId - ID of player to kick
 */
async function handleKickPlayer(playerId) {
  const state = gameStateManager.getState();
  if (!state || !state.isHost) return;

  const player = state.players?.find(p => p.id === playerId);
  if (!player) return;

  const confirmed = await showKickConfirmDialog(player.name);
  if (!confirmed) return;

  try {
    const result = await apiClient.kickPlayer(currentRoomId, playerToken, playerId);

    if (result.success) {
      showToast(`已踢出 ${player.name}`, 'success');
      gameStateManager.refresh();
    } else {
      showToast(apiClient.getErrorMessage(result.code, result.error), 'error');
    }
  } catch (err) {
    showToast('网络错误，请重试', 'error');
    console.error('Kick player error:', err);
  }
}

// ========================================
// Game Phase Handlers
// ========================================

/**
 * Handle confirm word button click (word-reveal phase)
 * For host: starts the description phase
 * For non-host: marks player as ready
 * Requirements: 5.6
 */
async function handleConfirmWord() {
  if (!currentRoomId || !playerToken) return;

  const state = gameStateManager.getState();
  const btn = document.getElementById('btn-confirm-word');
  const playerBtn = document.getElementById('btn-confirm-word-player');

  if (state?.isHost) {
    // Host starts the description phase
    if (btn) setButtonLoading(btn, true);

    try {
      const result = await apiClient.confirmWord(currentRoomId, playerToken);

      if (result.success) {
        showToast('描述阶段开始', 'success');
        gameStateManager.refresh();
      } else {
        showToast(apiClient.getErrorMessage(result.code, result.error), 'error');
      }
    } catch (err) {
      showToast('网络错误，请重试', 'error');
      console.error('Confirm word error:', err);
    } finally {
      if (btn) setButtonLoading(btn, false);
    }
  } else {
    // Non-host player confirms they've seen their word
    if (playerBtn) setButtonLoading(playerBtn, true);

    try {
      const result = await apiClient.confirmWordPlayer(currentRoomId, playerToken);

      if (result.success) {
        showToast('已确认', 'success');
        gameStateManager.refresh();
      } else {
        showToast(apiClient.getErrorMessage(result.code, result.error), 'error');
      }
    } catch (err) {
      showToast('网络错误，请重试', 'error');
      console.error('Confirm word player error:', err);
    } finally {
      if (playerBtn) setButtonLoading(playerBtn, false);
    }
  }
}

/**
 * Handle description form submission
 * Requirements: 6.1, 6.2
 * @param {Event} e - Form submit event
 */
async function handleSubmitDescription(e) {
  e.preventDefault();

  if (!currentRoomId || !playerToken) return;

  const input = document.getElementById('description-input');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const text = input?.value?.trim();

  if (!text || text.length < 2 || text.length > 50) {
    showToast('描述需要2-50个字符', 'error');
    return;
  }

  if (submitBtn) setButtonLoading(submitBtn, true);

  try {
    const result = await apiClient.submitDescription(currentRoomId, playerToken, text);

    if (result.success) {
      showToast('描述已提交', 'success');
      if (input) input.value = '';
      gameStateManager.refresh();
    } else {
      showToast(apiClient.getErrorMessage(result.code, result.error), 'error');
    }
  } catch (err) {
    showToast('网络错误，请重试', 'error');
    console.error('Submit description error:', err);
  } finally {
    if (submitBtn) setButtonLoading(submitBtn, false);
  }
}

/**
 * Handle next player button click (host only)
 * Requirements: 6.5
 */
async function handleNextPlayer() {
  if (!currentRoomId || !playerToken) return;

  const btn = document.getElementById('btn-next-player');
  if (btn) setButtonLoading(btn, true);

  try {
    const result = await apiClient.nextPlayer(currentRoomId, playerToken);

    if (result.success) {
      showToast('已跳过当前玩家', 'success');
      gameStateManager.refresh();
    } else {
      showToast(apiClient.getErrorMessage(result.code, result.error), 'error');
    }
  } catch (err) {
    showToast('网络错误，请重试', 'error');
    console.error('Next player error:', err);
  } finally {
    if (btn) setButtonLoading(btn, false);
  }
}

/**
 * Handle start voting button click (host only)
 * Requirements: 6.6
 */
async function handleStartVoting() {
  if (!currentRoomId || !playerToken) return;

  const btn = document.getElementById('btn-start-voting');
  if (btn) setButtonLoading(btn, true);

  try {
    const result = await apiClient.startVoting(currentRoomId, playerToken);

    if (result.success) {
      showToast('投票开始', 'success');
      gameStateManager.refresh();
    } else {
      showToast(apiClient.getErrorMessage(result.code, result.error), 'error');
    }
  } catch (err) {
    showToast('网络错误，请重试', 'error');
    console.error('Start voting error:', err);
  } finally {
    if (btn) setButtonLoading(btn, false);
  }
}

/**
 * Handle finalize voting button click (host only)
 * Requirements: 7.4
 */
async function handleFinalizeVoting() {
  if (!currentRoomId || !playerToken) return;

  const btn = document.getElementById('btn-finalize-voting');
  if (btn) setButtonLoading(btn, true);

  try {
    const result = await apiClient.finalizeVoting(currentRoomId, playerToken);

    if (result.success) {
      showToast('投票结束', 'success');
      gameStateManager.refresh();
    } else {
      showToast(apiClient.getErrorMessage(result.code, result.error), 'error');
    }
  } catch (err) {
    showToast('网络错误，请重试', 'error');
    console.error('Finalize voting error:', err);
  } finally {
    if (btn) setButtonLoading(btn, false);
  }
}

/**
 * Handle continue game button click (after result phase)
 * Requirements: 7.7
 */
async function handleContinueGame() {
  if (!currentRoomId || !playerToken) return;

  const btn = document.getElementById('btn-continue-game');
  if (btn) setButtonLoading(btn, true);

  try {
    const result = await apiClient.continueGame(currentRoomId, playerToken);

    if (result.success) {
      showToast('继续游戏', 'success');
      gameStateManager.refresh();
    } else {
      showToast(apiClient.getErrorMessage(result.code, result.error), 'error');
    }
  } catch (err) {
    showToast('网络错误，请重试', 'error');
    console.error('Continue game error:', err);
  } finally {
    if (btn) setButtonLoading(btn, false);
  }
}

/**
 * Handle restart game button click (host only)
 * Requirements: 8.5, 8.6 - Restart game with confirmation dialog
 */
async function handleRestartGame() {
  if (!currentRoomId || !playerToken) return;

  const confirmed = await showRestartConfirmDialog();
  if (!confirmed) return;

  try {
    const result = await apiClient.restartGame(currentRoomId, playerToken);

    if (result.success) {
      showToast('游戏已重置', 'success');
      gameStateManager.refresh();
    } else {
      showToast(apiClient.getErrorMessage(result.code, result.error), 'error');
    }
  } catch (err) {
    showToast('网络错误，请重试', 'error');
    console.error('Restart game error:', err);
  }
}

/**
 * Handle page changes
 * @param {string} currentPage - Current page name
 * @param {string} previousPage - Previous page name
 * @param {Object} params - Route parameters
 */
function handlePageChange(currentPage, previousPage, params) {
  // Update room code and password display when entering waiting room
  if (currentPage === 'waiting') {
    if (currentRoomCode) {
      const codeDisplay = document.getElementById('waiting-room-code');
      if (codeDisplay) {
        codeDisplay.textContent = currentRoomCode;
      }
    }
    // Show password if available (host only)
    if (currentRoomPassword) {
      const passwordDisplay = document.getElementById('waiting-room-password');
      if (passwordDisplay) {
        passwordDisplay.textContent = currentRoomPassword;
      }
    }
  }

  // Clear forms when leaving create/join pages
  if (previousPage === 'create') {
    document.getElementById('form-create')?.reset();
  }
  if (previousPage === 'join') {
    document.getElementById('form-join')?.reset();
  }
}

// ========================================
// Application Initialization
// ========================================

/**
 * Handle game state changes from polling
 * @param {Object|null} state - New room state
 * @param {string} reason - Reason for change ('update', 'room_closed')
 */
function handleGameStateChange(state, reason) {
  if (reason === 'room_closed') {
    showToast('房间已关闭', 'error');
    clearSession();
    router.navigate('home');
    return;
  }

  if (!state || !state.phase) {
    console.warn('Invalid state received:', state);
    return;
  }

  // Update UI based on current page and game phase
  const currentPage = router.getCurrentPage();

  console.log('handleGameStateChange - phase:', state.phase, 'currentPage:', currentPage);

  // Navigate to appropriate page based on game phase
  if (state.phase === 'waiting') {
    if (currentPage !== 'waiting' && currentPage !== 'home' && currentPage !== 'create' && currentPage !== 'join') {
      router.navigate('waiting');
    }
    // Update waiting room UI if we're on waiting page
    if (currentPage === 'waiting') {
      updateWaitingRoomUI(state);
    }
  } else {
    // Game is in progress (not waiting phase)
    if (currentPage === 'waiting') {
      router.navigate('game');
    }
    // Update game UI - do this regardless of navigation since we need to show the game state
    // Use setTimeout to ensure DOM is ready after navigation
    if (currentPage === 'waiting') {
      setTimeout(() => updateGameUI(state), 100);
    } else if (currentPage === 'game') {
      updateGameUI(state);
    }
  }
}

/**
 * Handle connection status changes
 * @param {boolean} isConnected - Connection status
 */
function handleConnectionChange(isConnected) {
  if (isConnected) {
    showToast('连接已恢复', 'success');
  } else {
    showToast('连接断开，正在重试...', 'error');
  }
}

/**
 * Update waiting room UI with current state
 * @param {Object} state - Room state
 */
function updateWaitingRoomUI(state) {
  // Update room code display
  const codeDisplay = document.getElementById('waiting-room-code');
  if (codeDisplay) {
    codeDisplay.textContent = state.roomCode;
  }

  // Update room password display (only visible to host who has the password)
  const passwordDisplaySection = document.querySelector('.room-password-display');
  const shareHint = document.querySelector('.share-hint');
  if (passwordDisplaySection) {
    // Show password section only if we have a password (host)
    if (currentRoomPassword) {
      passwordDisplaySection.style.display = 'flex';
      const passwordDisplay = document.getElementById('waiting-room-password');
      if (passwordDisplay) {
        passwordDisplay.textContent = currentRoomPassword;
      }
    } else {
      // Hide for non-host players
      passwordDisplaySection.style.display = 'none';
    }
  }
  if (shareHint) {
    shareHint.style.display = currentRoomPassword ? 'block' : 'none';
  }

  // Update player count
  const playerCount = document.getElementById('player-count');
  if (playerCount && state.players) {
    playerCount.textContent = state.players.length;
  }

  // Update player list
  const playerList = document.getElementById('player-list');
  if (playerList && state.players) {
    playerList.innerHTML = state.players.map(player => `
      <li class="${!player.isOnline ? 'offline' : ''}">
        <span class="player-name">${escapeHtml(player.name)}</span>
        ${player.isHost ? '<span class="host-badge">房主</span>' : ''}
        ${!player.isOnline ? '<span class="player-badge offline">OFFLINE</span>' : ''}
        ${state.isHost && !player.isHost ? `<button class="btn-icon btn-kick" data-player-id="${player.id}" title="踢出玩家">✕</button>` : ''}
      </li>
    `).join('');

    // Add kick button handlers
    if (state.isHost) {
      playerList.querySelectorAll('.btn-kick').forEach(btn => {
        btn.addEventListener('click', () => handleKickPlayer(btn.dataset.playerId));
      });
    }
  }

  // Update spy count display
  const spyCountDisplay = document.getElementById('spy-count-display');
  if (spyCountDisplay && state.settings) {
    spyCountDisplay.textContent = state.settings.spyCount;
  }

  // Show/hide host controls
  const hostControls = document.getElementById('host-controls');
  const guestWaiting = document.getElementById('guest-waiting');

  if (hostControls) {
    hostControls.classList.toggle('hidden', !state.isHost);
  }
  if (guestWaiting) {
    guestWaiting.classList.toggle('hidden', state.isHost);
  }

  // Update start button state
  const startBtn = document.getElementById('btn-start-game');
  if (startBtn && state.isHost) {
    const canStart = state.players && state.players.length >= 3 && state.settings.spyCount < state.players.length;
    startBtn.disabled = !canStart;

    // Update button text with player count info
    // Safe update of button text to preserve internal structure
    const btnText = startBtn.querySelector('.btn-text') || startBtn;
    if (state.players.length < 3) {
      btnText.textContent = `开始游戏 (需要${3 - state.players.length}人)`;
    } else {
      btnText.textContent = '开始游戏';
    }
  }
}

/**
 * Update game UI with current state
 * @param {Object} state - Room state
 */
function updateGameUI(state) {
  console.log('updateGameUI called with state:', state);
  console.log('Current phase:', state.phase);

  // Debug: Check if page-game is visible
  const gamePage = document.getElementById('page-game');
  console.log('Game page element:', gamePage);
  console.log('Game page classList:', gamePage?.className);
  console.log('Game page computed display:', gamePage ? window.getComputedStyle(gamePage).display : 'N/A');

  // Update game header
  const phaseDisplay = document.getElementById('game-phase');
  const roundDisplay = document.getElementById('game-round');

  if (phaseDisplay) {
    const phaseNames = {
      'word-reveal': '查看词语',
      'description': '描述阶段',
      'voting': '投票阶段',
      'result': '投票结果',
      'game-over': '游戏结束'
    };
    phaseDisplay.textContent = phaseNames[state.phase] || '游戏中';
  }

  if (roundDisplay) {
    roundDisplay.textContent = state.round || 1;
  }

  // Hide all game phase content
  document.querySelectorAll('.game-phase-content').forEach(el => {
    el.classList.add('hidden');
    el.style.display = 'none';
  });

  // Show current phase content
  const phaseElementId = `phase-${state.phase}`;
  const phaseElement = document.getElementById(phaseElementId);
  console.log('Looking for phase element:', phaseElementId, 'Found:', phaseElement);

  if (phaseElement) {
    console.log('Before removing hidden - classList:', phaseElement.className);
    phaseElement.classList.remove('hidden');
    console.log('After removing hidden - classList:', phaseElement.className);
    // Force display style as fallback (game-phase-content uses flex)
    phaseElement.style.display = 'flex';
  } else {
    console.error('Phase element not found for phase:', state.phase);
  }

  // Update phase-specific UI
  switch (state.phase) {
    case 'word-reveal':
      updateWordRevealUI(state);
      break;
    case 'description':
      updateDescriptionUI(state);
      break;
    case 'voting':
      updateVotingUI(state);
      break;
    case 'result':
      updateResultUI(state);
      break;
    case 'game-over':
      updateGameOverUI(state);
      break;
  }

  // Show/hide host restart button (visible in all game phases except waiting)
  const hostRestartBtn = document.getElementById('host-restart-btn');
  if (hostRestartBtn) {
    hostRestartBtn.classList.toggle('hidden', !state.isHost || state.phase === 'waiting');
  }
}

/**
 * Update word reveal phase UI
 * Requirements: 5.6 - Each player can only see their own word
 * @param {Object} state - Room state
 */
function updateWordRevealUI(state) {
  const wordDisplay = document.getElementById('my-word');
  if (wordDisplay) {
    wordDisplay.textContent = state.myWord || '???';
  }

  // Get current player's confirmation status
  const myPlayerId = state.myPlayerId;
  const myPlayer = state.players?.find(p => p.id === myPlayerId);
  const hasConfirmed = myPlayer?.hasConfirmedWord || false;

  // Show different UI for host and non-host players
  const confirmBtn = document.getElementById('btn-confirm-word');
  const playerConfirmBtn = document.getElementById('btn-confirm-word-player');
  const waitingHint = document.getElementById('word-reveal-waiting');
  const playerStatusList = document.getElementById('word-confirm-status');

  if (state.isHost) {
    // Host sees the "Start Description" button and player status
    if (confirmBtn) {
      confirmBtn.classList.remove('hidden');
      confirmBtn.disabled = false;
    }
    if (playerConfirmBtn) {
      playerConfirmBtn.classList.add('hidden');
    }
    if (waitingHint) {
      waitingHint.classList.add('hidden');
    }

    // Show player confirmation status for host
    if (playerStatusList && state.players) {
      const confirmedCount = state.players.filter(p => p.hasConfirmedWord).length;
      const totalCount = state.players.length;

      playerStatusList.innerHTML = `
        <p class="status-header">玩家就绪状态 (${confirmedCount}/${totalCount})</p>
        <ul class="player-status-list">
          ${state.players.map(p => `
            <li class="${p.hasConfirmedWord ? 'confirmed' : 'waiting'}">
              <span class="player-name">${escapeHtml(p.name)}</span>
              <span class="status-badge">${p.hasConfirmedWord ? '✓ 已就绪' : '等待中...'}</span>
            </li>
          `).join('')}
        </ul>
      `;
      playerStatusList.classList.remove('hidden');
    }
  } else {
    // Non-host players see "I remember" button or waiting message
    if (confirmBtn) {
      confirmBtn.classList.add('hidden');
    }
    if (playerStatusList) {
      playerStatusList.classList.add('hidden');
    }

    if (hasConfirmed) {
      // Already confirmed - show waiting message
      if (playerConfirmBtn) {
        playerConfirmBtn.classList.add('hidden');
      }
      if (waitingHint) {
        waitingHint.classList.remove('hidden');
        waitingHint.innerHTML = '<p>已确认，等待房主开始描述阶段...</p>';
      }
    } else {
      // Not confirmed yet - show confirm button
      if (playerConfirmBtn) {
        playerConfirmBtn.classList.remove('hidden');
        playerConfirmBtn.disabled = false;
      }
      if (waitingHint) {
        waitingHint.classList.add('hidden');
      }
    }
  }
}

/**
 * Update description phase UI
 * Requirements: 6.1, 6.2, 6.5, 6.6
 * @param {Object} state - Room state
 */
function updateDescriptionUI(state) {
  // Get alive players in order
  const alivePlayers = state.players ? state.players.filter(p => p.isAlive) : [];

  // Find current player based on turn
  const currentTurnIndex = alivePlayers.length > 0 ? state.currentTurn % alivePlayers.length : 0;
  const currentPlayer = alivePlayers[currentTurnIndex];

  // Update current player indicator
  const currentPlayerDisplay = document.getElementById('current-player-name');
  if (currentPlayerDisplay) {
    currentPlayerDisplay.textContent = currentPlayer ? currentPlayer.name : '---';
  }

  // Update description history
  const descriptionList = document.getElementById('description-list');
  if (descriptionList) {
    if (state.descriptions && state.descriptions.length > 0) {
      descriptionList.innerHTML = state.descriptions.map(desc => `
        <li>
          <span class="player-name">${escapeHtml(desc.playerName)}:</span>
          <span class="description-text">${desc.text ? escapeHtml(desc.text) : '<span class="skipped">（跳过）</span>'}</span>
        </li>
      `).join('');
    } else {
      descriptionList.innerHTML = '<li class="empty-state">暂无描述记录</li>';
    }
  }

  // Use myPlayerId from state to identify current player
  const myPlayerId = state.myPlayerId;
  const myPlayer = state.players?.find(p => p.id === myPlayerId);
  const isMyTurn = currentPlayer && currentPlayer.id === myPlayerId;
  const amIAlive = myPlayer?.isAlive || false;
  const hasDescribed = myPlayer?.hasDescribed || false;

  // Show/hide description input based on turn, alive status, and whether already described
  const myTurnInput = document.getElementById('my-turn-input');
  if (myTurnInput) {
    // Show input only if it's my turn, I'm alive, and I haven't described yet this round
    const shouldShowInput = isMyTurn && amIAlive && !hasDescribed;
    myTurnInput.classList.toggle('hidden', !shouldShowInput);
  }

  // Show/hide host game controls
  const hostGameControls = document.getElementById('host-game-controls');
  if (hostGameControls) {
    hostGameControls.classList.toggle('hidden', !state.isHost);
  }
}

// Track auto-finalize voting timer to prevent duplicate triggers
let autoFinalizeVotingTimer = null;

/**
 * Update voting phase UI
 * Requirements: 7.1, 7.4, + UX Enhancement: show descriptions during voting
 * @param {Object} state - Room state
 */
function updateVotingUI(state) {
  const alivePlayers = state.players ? state.players.filter(p => p.isAlive) : [];
  const votedCount = alivePlayers.filter(p => p.hasVoted).length;
  const allVoted = votedCount === alivePlayers.length && alivePlayers.length > 0;

  // === NEW: Render description history in voting phase ===
  const votingDescriptionList = document.getElementById('voting-description-list');
  if (votingDescriptionList) {
    if (state.descriptions && state.descriptions.length > 0) {
      votingDescriptionList.innerHTML = state.descriptions.map(desc => `
        <li>
          <span class="player-name">${escapeHtml(desc.playerName)}:</span>
          <span class="description-text">${desc.text ? escapeHtml(desc.text) : '<span class="skipped">（跳过）</span>'}</span>
        </li>
      `).join('');
    } else {
      votingDescriptionList.innerHTML = '<li class="empty-state">暂无描述记录</li>';
    }
  }

  // Update voting progress
  const voteCountDisplay = document.getElementById('vote-count');
  const aliveCountDisplay = document.getElementById('alive-count');
  if (voteCountDisplay) voteCountDisplay.textContent = votedCount;
  if (aliveCountDisplay) aliveCountDisplay.textContent = alivePlayers.length;

  // Use myPlayerId from state to identify current player
  const myPlayerId = state.myPlayerId;
  const myPlayer = state.players?.find(p => p.id === myPlayerId);
  const hasVoted = myPlayer?.hasVoted || false;

  // Update vote player list
  const voteList = document.getElementById('vote-player-list');
  if (voteList) {
    voteList.innerHTML = alivePlayers.map(player => {
      const isMe = player.id === myPlayerId;
      const canVote = !hasVoted && !isMe;

      return `
        <li class="${isMe ? 'disabled' : ''} ${player.hasVoted ? 'voted' : ''}" 
            data-player-id="${player.id}"
            ${canVote ? 'onclick="handleVoteClick(this)"' : ''}>
          <div class="player-info">
            <span class="player-name">${escapeHtml(player.name)}</span>
            ${isMe ? '<span class="player-badge">[YOU]</span>' : ''}
          </div>
          <div class="vote-status">
            ${player.hasVoted ? '<span class="voted-badge">已投票</span>' : ''}
          </div>
        </li>
      `;
    }).join('');
  }

  // Show/hide my vote status
  const myVoteStatus = document.getElementById('my-vote-status');
  if (myVoteStatus) {
    myVoteStatus.classList.toggle('hidden', !hasVoted);
  }

  // Show/hide host finalize voting button
  const hostFinalizeBtn = document.getElementById('btn-finalize-voting');
  if (hostFinalizeBtn) {
    hostFinalizeBtn.classList.toggle('hidden', !state.isHost);
    if (state.isHost) {
      const btnText = hostFinalizeBtn.querySelector('.btn-text') || hostFinalizeBtn;
      btnText.textContent = allVoted ? '结束投票' : '提前结束投票';
    }
  }

  // === NEW: Auto-finalize voting when all players have voted (host only) ===
  if (allVoted && state.isHost) {
    // Clear any existing timer
    if (autoFinalizeVotingTimer) {
      clearTimeout(autoFinalizeVotingTimer);
    }
    // Set a 1.5s delay before auto-finalizing to let users see the "all voted" state
    autoFinalizeVotingTimer = setTimeout(() => {
      // Double-check we're still in voting phase before finalizing
      const currentState = gameStateManager.getState();
      if (currentState && currentState.phase === 'voting' && currentState.isHost) {
        console.log('Auto-finalizing voting: all players have voted');
        handleFinalizeVoting();
      }
      autoFinalizeVotingTimer = null;
    }, 1500);
  } else {
    // If not all voted, clear any pending timer
    if (autoFinalizeVotingTimer) {
      clearTimeout(autoFinalizeVotingTimer);
      autoFinalizeVotingTimer = null;
    }
  }
}

/**
 * Update result phase UI
 * Requirements: 7.7
 * @param {Object} state - Room state
 */
function updateResultUI(state) {
  const resultDisplay = document.getElementById('elimination-result');
  if (resultDisplay && state.result) {
    const eliminatedIds = state.result.eliminatedPlayerIds || [];

    if (eliminatedIds.length > 0) {
      // Find all eliminated players
      const eliminatedPlayers = eliminatedIds
        .map(id => state.players?.find(p => p.id === id))
        .filter(p => p != null);

      if (eliminatedPlayers.length === 1) {
        // Single player eliminated
        resultDisplay.innerHTML = `
          <div class="eliminated-player">
            <p class="eliminated-name">${escapeHtml(eliminatedPlayers[0].name)}</p>
            <p class="eliminated-text">被淘汰了</p>
          </div>
        `;
      } else if (eliminatedPlayers.length > 1) {
        // Multiple players eliminated (tie)
        const names = eliminatedPlayers.map(p => escapeHtml(p.name)).join('、');
        resultDisplay.innerHTML = `
          <div class="eliminated-player">
            <p class="eliminated-name">${names}</p>
            <p class="eliminated-text">平票，全部被淘汰</p>
          </div>
        `;
      }
    } else {
      // No one eliminated
      resultDisplay.innerHTML = `
        <div class="no-elimination">
          <p>本轮无人被淘汰</p>
        </div>
      `;
    }
  }

  // Show continue button for host
  const continueBtn = document.getElementById('btn-continue-game');
  if (continueBtn) {
    continueBtn.classList.toggle('hidden', !state.isHost);
  }
}

/**
 * Update game over phase UI
 * Requirements: 8.3, 8.4
 * @param {Object} state - Room state
 */
function updateGameOverUI(state) {
  // Update winner announcement
  const winnerAnnouncement = document.getElementById('winner-announcement');
  if (winnerAnnouncement && state.result) {
    const isCivilianWin = state.result.winner === 'civilian';
    winnerAnnouncement.textContent = isCivilianWin ? '🎉 平民胜利！' : '🕵️ 卧底胜利！';
    winnerAnnouncement.className = isCivilianWin ? 'civilian-win' : 'spy-win';
  }

  // Show all player roles
  const roleList = document.getElementById('role-reveal-list');
  if (roleList && state.players) {
    roleList.innerHTML = state.players.map(player => {
      const roleText = player.role === 'spy' ? '卧底' : '平民';
      const roleClass = player.role === 'spy' ? 'spy' : 'civilian';
      const aliveStatus = player.isAlive ? '' : '（已淘汰）';

      return `
        <li>
          <span class="player-name">${escapeHtml(player.name)}${aliveStatus}</span>
          <span class="role-badge ${roleClass}">${roleText}</span>
        </li>
      `;
    }).join('');
  }

  // Show words - these are now returned by the API after game over
  const civilianWordDisplay = document.getElementById('civilian-word');
  const spyWordDisplay = document.getElementById('spy-word');

  if (civilianWordDisplay) {
    civilianWordDisplay.textContent = state.civilianWord || '---';
  }
  if (spyWordDisplay) {
    spyWordDisplay.textContent = state.spyWord || '---';
  }

  // Show/hide host restart controls
  const hostRestartControls = document.getElementById('host-restart-controls');
  if (hostRestartControls) {
    hostRestartControls.classList.toggle('hidden', !state.isHost);
  }
}

/**
 * Handle vote button click
 * Requirements: 7.1, 7.2, 7.3
 * @param {string} targetId - ID of player to vote for
 */
async function handleVote(targetId) {
  if (!currentRoomId || !playerToken) {
    return;
  }

  // Find target player name for confirmation
  const state = gameStateManager.getState();
  const targetPlayer = state?.players?.find(p => p.id === targetId);

  if (!targetPlayer) {
    showToast('无效的投票目标', 'error');
    return;
  }

  // Confirm vote
  const confirmed = await showConfirmDialog(`确定投票给 "${targetPlayer.name}" 吗？`);
  if (!confirmed) return;

  try {
    const result = await apiClient.vote(currentRoomId, playerToken, targetId);

    if (result.success) {
      showToast('投票成功', 'success');

      // Update my vote status display
      const myVoteStatus = document.getElementById('my-vote-status');
      const myVoteTarget = document.getElementById('my-vote-target');
      if (myVoteStatus && myVoteTarget) {
        myVoteTarget.textContent = targetPlayer.name;
        myVoteStatus.classList.remove('hidden');
      }

      gameStateManager.refresh();
    } else {
      showToast(apiClient.getErrorMessage(result.code, result.error), 'error');
    }
  } catch (err) {
    showToast('网络错误，请重试', 'error');
    console.error('Vote error:', err);
  }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Try to reconnect with existing session
 * @param {Object} session - Session data
 */
async function tryReconnect(session) {
  if (!session.token || !session.roomId) {
    return;
  }

  try {
    // Try to get room state with existing token
    const result = await apiClient.getRoomState(session.roomId, session.token);

    if (result.success && result.state) {
      // Session is valid, start polling and navigate to appropriate page
      playerToken = session.token;
      currentRoomId = session.roomId;
      currentRoomCode = session.roomCode;
      // Restore room password if available in session
      currentRoomPassword = session.roomPassword || null;

      gameStateManager.startPolling(session.roomId, session.token);

      // Use result.state.phase instead of result.phase
      if (result.state.phase === 'waiting') {
        router.navigate('waiting');
      } else {
        router.navigate('game');
      }

      showToast('已恢复游戏会话', 'success');
    } else {
      // Session invalid, clear it
      clearSession();
    }
  } catch (error) {
    console.error('Reconnect error:', error);
    clearSession();
  }
}

/**
 * Initialize the application
 */
function init() {
  console.log('谁是卧底 - Who is the Spy');

  // Initialize API client
  apiClient = new ApiClient();

  // Initialize game state manager
  gameStateManager = new GameStateManager(apiClient);
  gameStateManager.onStateChange(handleGameStateChange);
  gameStateManager.onConnectionChange(handleConnectionChange);

  // Load existing session
  const session = loadSession();

  // Initialize router
  router = new PageRouter();
  router.onPageChange(handlePageChange);

  // Setup event handlers
  setupEventHandlers();

  // If we have a session, try to reconnect
  if (session.token && session.roomId) {
    tryReconnect(session);
  }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Make handleVoteClick globally accessible for onclick handlers
window.handleVoteClick = function (element) {
  const playerId = element.dataset.playerId;
  if (playerId) {
    handleVote(playerId);
  }
};

// Export for potential testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PageRouter, ApiClient, GameStateManager, showToast, showConfirmDialog };
}
