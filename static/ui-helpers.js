/**
 * UI Helper Functions for NasrdaNavi
 * Provides utility functions for enhanced UI components
 */

/**
 * Toast Notification System
 */
const ToastNotification = {
    container: null,

    init() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            console.warn('Toast container not found');
        }
    },

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - Toast type: 'success', 'error', 'warning', 'info'
     * @param {number} duration - Duration in milliseconds (0 for no auto-hide)
     */
    show(message, type = 'info', duration = 3000) {
        if (!this.container) this.init();

        const toastId = 'toast-' + Date.now();
        const iconMap = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');

        toast.innerHTML = `
            <div class="toast-header">
                <i class="fas ${iconMap[type]} me-2"></i>
                <strong class="me-auto">${this.getTitle(type)}</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        `;

        this.container.appendChild(toast);

        // Initialize Bootstrap toast
        const bsToast = new bootstrap.Toast(toast, {
            autohide: duration > 0,
            delay: duration
        });

        bsToast.show();

        // Remove from DOM after hidden
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });

        // Announce to screen readers
        this.announceToScreenReader(message, type);

        return toastId;
    },

    getTitle(type) {
        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Info'
        };
        return titles[type] || 'Notification';
    },

    announceToScreenReader(message, type) {
        const srElement = type === 'error' ? document.getElementById('srAlert') : document.getElementById('srStatus');
        if (srElement) {
            srElement.textContent = message;
            // Clear after a delay
            setTimeout(() => {
                srElement.textContent = '';
            }, 1000);
        }
    },

    success(message, duration = 3000) {
        return this.show(message, 'success', duration);
    },

    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    },

    warning(message, duration = 4000) {
        return this.show(message, 'warning', duration);
    },

    info(message, duration = 3000) {
        return this.show(message, 'info', duration);
    }
};

/**
 * Loading State Manager
 */
const LoadingState = {
    spinner: null,
    inputProgress: null,

    init() {
        this.spinner = document.getElementById('loadingSpinner');
        this.inputProgress = document.getElementById('inputProgress');
    },

    showSpinner(message = 'Loading...') {
        if (!this.spinner) this.init();
        
        if (this.spinner) {
            const textElement = this.spinner.querySelector('.loading-text');
            if (textElement) {
                textElement.textContent = message;
            }
            this.spinner.style.display = 'flex';
        }
    },

    hideSpinner() {
        if (this.spinner) {
            this.spinner.style.display = 'none';
        }
    },

    showInputProgress() {
        if (!this.inputProgress) this.init();
        
        const inputGroup = this.inputProgress?.parentElement;
        if (inputGroup) {
            inputGroup.classList.add('searching');
        }
    },

    hideInputProgress() {
        if (!this.inputProgress) this.init();
        
        const inputGroup = this.inputProgress?.parentElement;
        if (inputGroup) {
            inputGroup.classList.remove('searching');
        }
    },

    showSkeleton() {
        const skeleton = document.getElementById('skeletonLoader');
        if (skeleton) {
            skeleton.style.display = 'block';
        }
    },

    hideSkeleton() {
        const skeleton = document.getElementById('skeletonLoader');
        if (skeleton) {
            skeleton.style.display = 'none';
        }
    }
};

/**
 * Search Category Manager
 */
const CategoryManager = {
    currentCategory: 'all',
    callbacks: [],

    init() {
        const categoryChips = document.querySelectorAll('.category-chip');
        categoryChips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                this.selectCategory(e.currentTarget.dataset.category);
            });
        });
    },

    selectCategory(category) {
        this.currentCategory = category;

        // Update UI
        document.querySelectorAll('.category-chip').forEach(chip => {
            const isActive = chip.dataset.category === category;
            chip.classList.toggle('active', isActive);
            chip.setAttribute('aria-pressed', isActive);
        });

        // Notify callbacks
        this.callbacks.forEach(callback => callback(category));

        // Announce to screen reader
        const srStatus = document.getElementById('srStatus');
        if (srStatus) {
            srStatus.textContent = `Filtering by ${category}`;
        }
    },

    onCategoryChange(callback) {
        this.callbacks.push(callback);
    },

    getCurrentCategory() {
        return this.currentCategory;
    }
};

/**
 * Search Results Manager
 */
const SearchResultsManager = {
    resultsContainer: null,
    emptyState: null,

    init() {
        this.resultsContainer = document.getElementById('searchResults');
        this.emptyState = document.getElementById('searchEmptyState');
    },

    showResults(results) {
        if (!this.resultsContainer) this.init();

        if (!results || results.length === 0) {
            this.showEmptyState();
            return;
        }

        this.hideEmptyState();
        this.resultsContainer.style.display = 'block';
        
        // Results are populated by existing code
    },

    hideResults() {
        if (this.resultsContainer) {
            this.resultsContainer.style.display = 'none';
            this.resultsContainer.innerHTML = '';
        }
        this.hideEmptyState();
    },

    showEmptyState() {
        if (this.resultsContainer) {
            this.resultsContainer.style.display = 'none';
        }
        if (this.emptyState) {
            this.emptyState.style.display = 'block';
        }
    },

    hideEmptyState() {
        if (this.emptyState) {
            this.emptyState.style.display = 'none';
        }
    }
};

/**
 * FAB Menu Manager
 */
const FABMenu = {
    container: null,
    isVisible: false,
    isMenuOpen: false,
    saveBtn: null,
    mainBtn: null,
    menu: null,

    init() {
        this.container = document.getElementById('fabContainer');
        if (!this.container) return;

        this.mainBtn = this.container.querySelector('.fab-main');
        this.menu = this.container.querySelector('.fab-menu');

        // Setup main button toggle
        if (this.mainBtn) {
            this.mainBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMenu();
            });
        }

        // Setup button actions
        const myLocationBtn = document.getElementById('fabMyLocation');
        const shareBtn = document.getElementById('fabShare');
        this.saveBtn = document.getElementById('fabSave');

        if (myLocationBtn) {
            myLocationBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.onMyLocation();
                this.closeMenu();
            });
        }

        if (shareBtn) {
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.onShare();
                this.closeMenu();
            });
        }

        if (this.saveBtn) {
            this.saveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.onSave();
                this.closeMenu();
            });
            // Add badge to save button showing count
            this.updateSaveButtonBadge();
        }

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isMenuOpen && !this.container.contains(e.target)) {
                this.closeMenu();
            }
        });

        // Close menu with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isMenuOpen) {
                this.closeMenu();
                if (this.mainBtn) {
                    this.mainBtn.focus(); // Return focus to main button
                }
            }
        });

        // Auto-hide FAB during navigation mode
        this.setupVisibilityWatcher();
    },

    toggleMenu() {
        if (this.isMenuOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    },

    openMenu() {
        if (!this.container || !this.menu) return;
        
        this.container.classList.add('menu-open');
        this.isMenuOpen = true;
        
        // Update ARIA
        if (this.mainBtn) {
            this.mainBtn.setAttribute('aria-expanded', 'true');
        }
    },

    closeMenu() {
        if (!this.container || !this.menu) return;
        
        this.container.classList.remove('menu-open');
        this.isMenuOpen = false;
        
        // Update ARIA
        if (this.mainBtn) {
            this.mainBtn.setAttribute('aria-expanded', 'false');
        }
    },

    show() {
        if (this.container) {
            this.container.style.display = 'block';
            this.isVisible = true;
        }
    },

    hide() {
        if (this.container) {
            this.closeMenu(); // Close menu when hiding FAB
            this.container.style.display = 'none';
            this.isVisible = false;
        }
    },

    setupVisibilityWatcher() {
        // Check visibility based on navigation mode
        setInterval(() => {
            const isNavMode = window.isInNavigationMode?.();
            if (isNavMode && this.isVisible) {
                this.hide();
            } else if (!isNavMode && !this.isVisible && window.map) {
                this.show();
            }
        }, 1000);
    },

    updateSaveButtonBadge() {
        if (!this.saveBtn) return;
        
        try {
            const savedRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
            const count = savedRoutes.length;
            
            if (count > 0) {
                // Add or update badge
                let badge = this.saveBtn.querySelector('.badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'badge';
                    badge.style.cssText = `
                        position: absolute;
                        top: -5px;
                        right: -5px;
                        background: #dc3545;
                        color: white;
                        border-radius: 10px;
                        padding: 2px 6px;
                        font-size: 10px;
                        font-weight: bold;
                        min-width: 18px;
                        text-align: center;
                    `;
                    this.saveBtn.style.position = 'relative';
                    this.saveBtn.appendChild(badge);
                }
                badge.textContent = count > 9 ? '9+' : count;
            }
        } catch (error) {
            console.warn('Could not update save button badge:', error);
        }
    },

    onMyLocation() {
        // Trigger geolocation - integrate with map.js
        if (window.geolocate) {
            try {
                window.geolocate.trigger();
                ToastNotification.info('Getting your location...');
            } catch (error) {
                console.warn('Geolocation trigger failed:', error);
                ToastNotification.warning('Please use the location button on the map');
            }
        } else if (window.recenterMap) {
            // Fallback: recenter on current location if available
            window.recenterMap();
            ToastNotification.info('Centering on your location...');
        } else {
            ToastNotification.warning('Geolocation not available');
        }
    },

    onShare() {
        if (!window.map) {
            ToastNotification.warning('Map not ready yet');
            return;
        }

        // Check if we have an active route to share
        const hasRoute = window.hasActiveRoute?.();
        const startPoint = window.getStartPoint?.();
        const endPoint = window.getEndPoint?.();
        
        let shareText, shareUrl;
        
        if (hasRoute && startPoint && endPoint) {
            // Share route
            shareText = `Check out this route on NasrdaNavi`;
            shareUrl = `${window.location.origin}${window.location.pathname}?start=${startPoint.lat.toFixed(6)},${startPoint.lng.toFixed(6)}&end=${endPoint.lat.toFixed(6)},${endPoint.lng.toFixed(6)}`;
        } else {
            // Share current location
            const center = window.map.getCenter();
            shareText = 'Check out this location on NasrdaNavi';
            shareUrl = `${window.location.origin}${window.location.pathname}?lat=${center.lat.toFixed(6)}&lng=${center.lng.toFixed(6)}`;
        }
        
        // Try native share API first
        if (navigator.share) {
            navigator.share({
                title: 'NasrdaNavi',
                text: shareText,
                url: shareUrl
            }).then(() => {
                ToastNotification.success(hasRoute ? 'Route shared successfully!' : 'Location shared successfully!');
            }).catch((error) => {
                if (error.name !== 'AbortError') {
                    // Fallback: copy to clipboard
                    this.copyToClipboard(shareUrl);
                }
            });
        } else {
            // Fallback: copy URL to clipboard
            this.copyToClipboard(shareUrl);
        }
    },

    onSave() {
        // Save current route to local storage
        const hasRoute = window.hasActiveRoute?.();
        const route = window.getCurrentRoute?.();
        const start = window.getStartPoint?.();
        const end = window.getEndPoint?.();
        
        if (hasRoute && route && start && end) {
            try {
                // Create route object with all necessary information
                const savedRoute = {
                    start: {
                        lat: start.lat,
                        lng: start.lng
                    },
                    end: {
                        lat: end.lat,
                        lng: end.lng
                    },
                    distance: route.distance || 0,
                    timestamp: Date.now(),
                    date: new Date().toISOString()
                };
                
                // Get existing routes from localStorage
                const savedRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
                
                // Add new route at the beginning (most recent first)
                savedRoutes.unshift(savedRoute);
                
                // Limit to last 10 routes
                const limitedRoutes = savedRoutes.slice(0, 10);
                
                // Save back to localStorage
                localStorage.setItem('savedRoutes', JSON.stringify(limitedRoutes));
                
                ToastNotification.success(`Route saved! (${limitedRoutes.length}/10 saved routes)`);
                
                // Update badge to reflect new count
                this.updateSaveButtonBadge();
                
                // Log for debugging
                console.log('Route saved:', savedRoute);
            } catch (error) {
                console.error('Error saving route:', error);
                ToastNotification.error('Failed to save route');
            }
        } else {
            ToastNotification.warning('No active route to save. Please create a route first.');
        }
    },

    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                ToastNotification.success('Link copied to clipboard!');
            }).catch(() => {
                ToastNotification.error('Failed to copy link');
            });
        } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                ToastNotification.success('Link copied to clipboard!');
            } catch (err) {
                ToastNotification.error('Failed to copy link');
            }
            document.body.removeChild(textarea);
        }
    }
};

/**
 * Directions Panel Manager
 */
const DirectionsPanelManager = {
    panel: null,
    isMinimized: false,

    init() {
        this.panel = document.getElementById('directionsPanel');
        if (!this.panel) return;

        // Add swipe gesture support on mobile
        if (window.innerWidth <= 768) {
            this.addSwipeSupport();
        }
    },

    addSwipeSupport() {
        if (!this.panel) return;

        let startY = 0;
        let currentY = 0;
        const swipeIndicator = this.panel.querySelector('.swipe-indicator');

        if (!swipeIndicator) return;

        swipeIndicator.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        });

        swipeIndicator.addEventListener('touchmove', (e) => {
            currentY = e.touches[0].clientY;
        });

        swipeIndicator.addEventListener('touchend', () => {
            const deltaY = currentY - startY;
            
            if (Math.abs(deltaY) > 50) {
                if (deltaY > 0) {
                    this.minimize();
                } else {
                    this.maximize();
                }
            }
        });
    },

    minimize() {
        if (this.panel) {
            this.panel.classList.add('minimized');
            this.isMinimized = true;
        }
    },

    maximize() {
        if (this.panel) {
            this.panel.classList.remove('minimized');
            this.isMinimized = false;
        }
    },

    toggle() {
        if (this.isMinimized) {
            this.maximize();
        } else {
            this.minimize();
        }
    }
};

/**
 * Initialize all UI helpers when DOM is ready
 */
function initUIHelpers() {
    ToastNotification.init();
    LoadingState.init();
    CategoryManager.init();
    SearchResultsManager.init();
    FABMenu.init();
    DirectionsPanelManager.init();

    // Splash screen: ensure animations complete before hiding
    const splashEl = document.getElementById('appSplash');
    if (splashEl) {
        let splashHidden = false;
        const MIN_SPLASH_DURATION = 6000; // 6 seconds - allows all animations to complete
        const splashStartTime = window.splashStartTime || Date.now();
        
        function hideSplash() {
            if (!splashHidden && splashEl && !splashEl.classList.contains('is-hidden')) {
                const elapsed = Date.now() - splashStartTime;
                const remaining = Math.max(0, MIN_SPLASH_DURATION - elapsed);
                
                setTimeout(() => {
                    if (!splashHidden && splashEl && !splashEl.classList.contains('is-hidden')) {
                        splashEl.classList.add('is-hidden');
                        // Mark body as splash complete to trigger UI animations
                        document.body.classList.add('splash-complete');
                        splashHidden = true;
                        // Hide completely after fade-out animation
                        setTimeout(() => {
                            if (splashEl.classList.contains('is-hidden')) {
                                splashEl.classList.add('animation-complete');
                                splashEl.style.display = 'none';
                            }
                        }, 1000); // Match splash-fade-out animation duration
                    }
                }, remaining);
            }
        }
        
        // Wait for map to be ready AND ensure minimum duration has passed
        const splashCheck = setInterval(() => {
            if (window.map && window.map.loaded) {
                clearInterval(splashCheck);
                hideSplash(); // This will respect the minimum duration
            }
        }, 100);

        // Fallback: hide after minimum duration + buffer
        setTimeout(() => {
            clearInterval(splashCheck);
            if (!splashHidden) {
                hideSplash();
            }
        }, MIN_SPLASH_DURATION + 2000); // 8 seconds total as absolute maximum
    }

    // Show FAB menu only when map is ready
    const checkMapReady = setInterval(() => {
        if (window.map) {
            clearInterval(checkMapReady);
            setTimeout(() => {
                FABMenu.show();
            }, 500);
        }
    }, 100);
    
    // Timeout after 10 seconds if map doesn't load
    setTimeout(() => {
        clearInterval(checkMapReady);
    }, 10000);
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUIHelpers);
} else {
    initUIHelpers();
}

// Export for use in other scripts
window.ToastNotification = ToastNotification;
window.LoadingState = LoadingState;
window.CategoryManager = CategoryManager;
window.SearchResultsManager = SearchResultsManager;
window.FABMenu = FABMenu;
window.DirectionsPanelManager = DirectionsPanelManager;

