// Утилиты для уведомлений и вспомогательные функции
class NotificationUtils {
    constructor() {
        this.notificationContainer = null;
        this.init();
    }

    init() {
        // Создаем контейнер для уведомлений если его нет
        if (!document.getElementById('notificationContainer')) {
            this.notificationContainer = document.createElement('div');
            this.notificationContainer.id = 'notificationContainer';
            document.body.appendChild(this.notificationContainer);
        } else {
            this.notificationContainer = document.getElementById('notificationContainer');
        }
    }

    showNotification(message, type = 'info', duration = 5000) {
        try {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = `
                <div class="notification-content">
                    ${message}
                </div>
            `;

            // Добавляем в контейнер
            this.notificationContainer.appendChild(notification);

            // Автоматическое скрытие
            if (duration > 0) {
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.style.opacity = '0';
                        notification.style.transform = 'translateX(100%)';
                        setTimeout(() => {
                            if (notification.parentNode) {
                                notification.parentNode.removeChild(notification);
                            }
                        }, 300);
                    }
                }, duration);
            }

            // Клик для закрытия
            notification.addEventListener('click', () => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            });

            // Анимация появления
            setTimeout(() => {
                notification.style.transform = 'translateX(0)';
                notification.style.opacity = '1';
            }, 10);

            return notification;

        } catch (error) {
            console.error('Error showing notification:', error);
            // Фолбэк в console
            const consoleMethod = type === 'error' ? 'error' : 
                                type === 'warning' ? 'warn' : 'log';
            console[consoleMethod](`[${type.toUpperCase()}] ${message}`);
        }
    }
}

// Создаем глобальный экземпляр
const notificationUtils = new NotificationUtils();

// Глобальные функции для обратной совместимости
function showSuccess(message, duration = 5000) {
    return notificationUtils.showNotification(message, 'success', duration);
}

function showError(message, duration = 5000) {
    return notificationUtils.showNotification(message, 'error', duration);
}

function showWarning(message, duration = 5000) {
    return notificationUtils.showNotification(message, 'warning', duration);
}

function showInfo(message, duration = 5000) {
    return notificationUtils.showNotification(message, 'info', duration);
}

// Вспомогательные функции
function formatDate(date) {
    return new Date(date).toLocaleString('ru-RU');
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showSuccess,
        showError,
        showWarning,
        showInfo,
        formatDate,
        generateId,
        debounce
    };
}