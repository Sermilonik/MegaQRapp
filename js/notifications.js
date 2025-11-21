class NotificationManager {
    constructor() {
        this.storageKey = 'warehouse_notifications';
        this.reportsStorageKey = 'warehouse_reports';
    }

    // Уведомления для склада
    sendToWarehouse(notification) {
        const notifications = this.getWarehouseNotifications();
        notifications.unshift({
            id: this.generateId(),
            type: notification.type || 'info',
            message: notification.message,
            contractorName: notification.contractorName,
            codeCount: notification.codeCount,
            reportId: notification.reportId,
            processedAt: new Date().toISOString(),
            read: false
        });
        
        // Сохраняем только последние 50 уведомлений
        if (notifications.length > 50) {
            notifications.splice(50);
        }
        
        localStorage.setItem(this.storageKey, JSON.stringify(notifications));
        this.dispatchWarehouseNotificationEvent();
    }

    // Уведомления для бухгалтерии
    sendToAccountant(notification) {
        const notifications = this.getAccountantNotifications();
        notifications.unshift({
            id: this.generateId(),
            type: notification.type || 'info',
            message: notification.message,
            contractorName: notification.contractorName,
            codeCount: notification.codeCount,
            reportId: notification.reportId,
            createdAt: new Date().toISOString(),
            status: 'new'
        });
        
        if (notifications.length > 50) {
            notifications.splice(50);
        }
        
        localStorage.setItem('accountant_notifications', JSON.stringify(notifications));
        this.dispatchAccountantNotificationEvent();
    }

    // Сохраняем отчет для бухгалтерии
    saveReportForAccountant(report) {
        const reports = this.getPendingReports();
        reports.unshift({
            ...report,
            status: 'pending',
            submittedAt: new Date().toISOString(),
            processedAt: null,
            processedBy: null
        });
        
        localStorage.setItem(this.reportsStorageKey, JSON.stringify(reports));
        
        // Отправляем уведомление бухгалтеру
        this.sendToAccountant({
            type: 'new_report',
            message: `Новый отчет от склада`,
            contractorName: report.contractorName,
            codeCount: report.codes.length,
            reportId: report.id
        });
    }

    // Получаем отчеты для бухгалтерии
    getPendingReports() {
        return JSON.parse(localStorage.getItem(this.reportsStorageKey) || '[]');
    }

    // Обновляем статус отчета
    updateReportStatus(reportId, status, processedBy = null) {
        const reports = this.getPendingReports();
        const reportIndex = reports.findIndex(r => r.id === reportId);
        
        if (reportIndex !== -1) {
            reports[reportIndex].status = status;
            reports[reportIndex].processedAt = new Date().toISOString();
            reports[reportIndex].processedBy = processedBy;
            
            localStorage.setItem(this.reportsStorageKey, JSON.stringify(reports));
            
            // Уведомляем склад об изменении статуса
            if (status === 'processed') {
                this.sendToWarehouse({
                    type: 'report_processed',
                    message: `Отчет обработан бухгалтерией`,
                    contractorName: reports[reportIndex].contractorName,
                    codeCount: reports[reportIndex].codes.length,
                    reportId: reportId
                });
            }
            
            return true;
        }
        return false;
    }

    getWarehouseNotifications() {
        return JSON.parse(localStorage.getItem(this.storageKey) || '[]');
    }

    getAccountantNotifications() {
        return JSON.parse(localStorage.getItem('accountant_notifications') || '[]');
    }

    markAsRead(notificationId) {
        const notifications = this.getWarehouseNotifications();
        const notification = notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            localStorage.setItem(this.storageKey, JSON.stringify(notifications));
            this.dispatchWarehouseNotificationEvent();
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    dispatchWarehouseNotificationEvent() {
        window.dispatchEvent(new CustomEvent('warehouseNotificationsUpdated'));
    }

    dispatchAccountantNotificationEvent() {
        window.dispatchEvent(new CustomEvent('accountantNotificationsUpdated'));
    }
}