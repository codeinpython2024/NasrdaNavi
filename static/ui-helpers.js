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

    init() {
        this.container = document.getElementById('fabContainer');
        if (!this.container) return;

        // Setup button actions
        const myLocationBtn = document.getElementById('fabMyLocation');
        const shareBtn = document.getElementById('fabShare');
        const saveBtn = document.getElementById('fabSave');

        if (myLocationBtn) {
            myLocationBtn.addEventListener('click', () => this.onMyLocation());
        }

        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.onShare());
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.onSave());
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
            this.container.style.display = 'none';
            this.isVisible = false;
        }
    },

    onMyLocation() {
        // Trigger geolocation - integrate with map.js
        if (window.geolocateControl) {
            window.geolocateControl.trigger();
        }
        ToastNotification.info('Getting your location...');
    },

    onShare() {
        // Share current location or route
        if (navigator.share && window.map) {
            const center = window.map.getCenter();
            const url = `${window.location.origin}${window.location.pathname}?lat=${center.lat.toFixed(6)}&lng=${center.lng.toFixed(6)}`;
            
            navigator.share({
                title: 'NasrdaNavi Location',
                text: 'Check out this location',
                url: url
            }).then(() => {
                ToastNotification.success('Location shared successfully!');
            }).catch((error) => {
                if (error.name !== 'AbortError') {
                    // Fallback: copy to clipboard
                    this.copyToClipboard(url);
                }
            });
        } else {
            // Fallback: copy URL to clipboard
            const center = window.map?.getCenter();
            if (center) {
                const url = `${window.location.origin}${window.location.pathname}?lat=${center.lat.toFixed(6)}&lng=${center.lng.toFixed(6)}`;
                this.copyToClipboard(url);
            }
        }
    },

    onSave() {
        // Save current route to local storage
        if (window.currentRoute) {
            const route = {
                start: window.startPoint,
                end: window.endPoint,
                timestamp: Date.now()
            };
            
            const savedRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
            savedRoutes.push(route);
            localStorage.setItem('savedRoutes', JSON.stringify(savedRoutes));
            
            ToastNotification.success('Route saved successfully!');
        } else {
            ToastNotification.warning('No active route to save');
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

    // Show FAB menu after a delay
    setTimeout(() => {
        FABMenu.show();
    }, 1000);
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

