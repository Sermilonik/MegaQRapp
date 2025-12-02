// firebase-sync.js
class FirebaseSync {
    constructor(appState) {
        this.appState = appState;
        this.db = null;
        this.auth = null;
        this.isConnected = false;
        this.userId = null;
        this.deviceId = appState ? appState.deviceId : null;
    }
    
    async init() {
        try {
            // Проверяем наличие Firebase
            if (typeof firebase === 'undefined') {
                console.log('ℹ️ Firebase не загружен');
                return false;
            }
            
            // Инициализируем Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(window.firebaseConfig);
            }
            
            this.db = firebase.firestore();
            this.auth = firebase.auth();
            
            // Анонимная аутентификация
            await this.auth.signInAnonymously();
            
            this.userId = this.auth.currentUser ? this.auth.currentUser.uid : 'anonymous';
            this.isConnected = true;
            
            console.log('✅ Firebase подключен');
            
            // Настраиваем слушатели изменений
            this.setupListeners();
            
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка инициализации Firebase:', error);
            this.isConnected = false;
            return false;
        }
    }
    
    setupListeners() {
        if (!this.db || !this.userId) return;
        
        // Слушаем изменения контрагентов
        this.db.collection('users').doc(this.userId)
            .collection('contractors')
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added' || change.type === 'modified') {
                        const contractor = change.doc.data();
                        this.handleContractorUpdate(contractor);
                    }
                });
            });
        
        // Слушаем изменения отчетов
        this.db.collection('users').doc(this.userId)
            .collection('reports')
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added' || change.type === 'modified') {
                        const report = change.doc.data();
                        this.handleReportUpdate(report);
                    }
                });
            });
    }
    
    handleContractorUpdate(contractor) {
        if (!this.appState) return;
        
        // Игнорируем свои собственные обновления
        if (contractor.deviceId === this.deviceId) {
            return;
        }
        
        console.log('📡 Получен контрагент из облака:', contractor.name);
        
        // Обновляем локальные данные
        this.appState.mergeContractors([contractor]);
        this.appState.saveContractors();
        
        // Показываем уведомление
        showInfo(`Обновлен контрагент: ${contractor.name}`, 3000);
    }
    
    handleReportUpdate(report) {
        if (!this.appState) return;
        
        // Игнорируем свои собственные обновления
        if (report.deviceId === this.deviceId) {
            return;
        }
        
        console.log('📡 Получен отчет из облака:', report.id);
        
        // Обновляем локальные данные
        this.appState.mergeReports([report]);
        this.appState.saveReports();
    }
    
    // Синхронизация контрагентов
    async syncContractors(localContractors) {
        if (!this.isConnected || !this.db || !this.userId) {
            console.log('ℹ️ Firebase не подключен, пропускаем синхронизацию');
            return localContractors;
        }
        
        try {
            // Получаем контрагентов из облака
            const snapshot = await this.db.collection('users').doc(this.userId)
                .collection('contractors')
                .get();
            
            const cloudContractors = [];
            snapshot.forEach(doc => {
                cloudContractors.push(doc.data());
            });
            
            console.log(`📊 Облачные контрагенты: ${cloudContractors.length}, Локальные: ${localContractors.length}`);
            
            // Объединяем данные
            const mergedContractors = this.mergeData(localContractors, cloudContractors);
            
            // Сохраняем обратно в облако
            await this.saveContractorsToCloud(mergedContractors);
            
            return mergedContractors;
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации контрагентов:', error);
            return localContractors;
        }
    }
    
    // Синхронизация отчетов
    async syncReports(localReports) {
        if (!this.isConnected || !this.db || !this.userId) {
            console.log('ℹ️ Firebase не подключен, пропускаем синхронизацию');
            return localReports;
        }
        
        try {
            // Получаем отчеты из облака
            const snapshot = await this.db.collection('users').doc(this.userId)
                .collection('reports')
                .get();
            
            const cloudReports = [];
            snapshot.forEach(doc => {
                cloudReports.push(doc.data());
            });
            
            console.log(`📊 Облачные отчеты: ${cloudReports.length}, Локальные: ${localReports.length}`);
            
            // Объединяем данные
            const mergedReports = this.mergeData(localReports, cloudReports);
            
            // Сохраняем обратно в облако
            await this.saveReportsToCloud(mergedReports);
            
            return mergedReports;
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации отчетов:', error);
            return localReports;
        }
    }
    
    // Объединение данных
    mergeData(localData, cloudData) {
        const merged = [...localData];
        const dataMap = new Map();
        
        // Добавляем локальные данные в карту
        localData.forEach(item => {
            dataMap.set(item.id, { ...item, source: 'local' });
        });
        
        // Добавляем или обновляем облачными данными
        cloudData.forEach(cloudItem => {
            const existing = dataMap.get(cloudItem.id);
            
            if (existing) {
                // Сравниваем даты обновления
                const existingDate = new Date(existing.updatedAt || existing.createdAt);
                const cloudDate = new Date(cloudItem.updatedAt || cloudItem.createdAt);
                
                if (cloudDate > existingDate) {
                    dataMap.set(cloudItem.id, { ...cloudItem, source: 'cloud' });
                }
            } else {
                dataMap.set(cloudItem.id, { ...cloudItem, source: 'cloud' });
            }
        });
        
        // Преобразуем обратно в массив
        return Array.from(dataMap.values()).map(({ source, ...item }) => item);
    }
    
    // Сохранение контрагентов в облако
    async saveContractorsToCloud(contractors) {
        if (!this.isConnected || !this.db || !this.userId) return;
        
        try {
            const batch = this.db.batch();
            const collectionRef = this.db.collection('users').doc(this.userId).collection('contractors');
            
            // Ограничиваем количество операций в батче
            const chunkSize = 50;
            for (let i = 0; i < contractors.length; i += chunkSize) {
                const chunk = contractors.slice(i, i + chunkSize);
                
                chunk.forEach(contractor => {
                    const docRef = collectionRef.doc(contractor.id.toString());
                    batch.set(docRef, {
                        ...contractor,
                        deviceId: this.deviceId,
                        updatedAt: new Date().toISOString()
                    });
                });
                
                await batch.commit();
            }
            
            console.log(`✅ Контрагенты сохранены в облако: ${contractors.length}`);
            
        } catch (error) {
            console.error('❌ Ошибка сохранения контрагентов в облако:', error);
        }
    }
    
    // Сохранение отчетов в облако
    async saveReportsToCloud(reports) {
        if (!this.isConnected || !this.db || !this.userId) return;
        
        try {
            const batch = this.db.batch();
            const collectionRef = this.db.collection('users').doc(this.userId).collection('reports');
            
            reports.forEach(report => {
                const docRef = collectionRef.doc(report.id.toString());
                batch.set(docRef, {
                    ...report,
                    deviceId: this.deviceId,
                    updatedAt: new Date().toISOString()
                });
            });
            
            await batch.commit();
            console.log(`✅ Отчеты сохранены в облако: ${reports.length}`);
            
        } catch (error) {
            console.error('❌ Ошибка сохранения отчетов в облако:', error);
        }
    }
    
    // Добавление контрагента
    async addContractor(contractor) {
        if (!this.isConnected || !this.db || !this.userId) return;
        
        try {
            await this.db.collection('users').doc(this.userId)
                .collection('contractors')
                .doc(contractor.id.toString())
                .set({
                    ...contractor,
                    deviceId: this.deviceId,
                    updatedAt: new Date().toISOString()
                });
            
            console.log('✅ Контрагент добавлен в облако:', contractor.name);
            
        } catch (error) {
            console.error('❌ Ошибка добавления контрагента в облако:', error);
        }
    }
    
    // Удаление контрагента
    async deleteContractor(contractorId) {
        if (!this.isConnected || !this.db || !this.userId) return;
        
        try {
            await this.db.collection('users').doc(this.userId)
                .collection('contractors')
                .doc(contractorId.toString())
                .delete();
            
            console.log('✅ Контрагент удален из облака:', contractorId);
            
        } catch (error) {
            console.error('❌ Ошибка удаления контрагента из облака:', error);
        }
    }
    
    // Добавление отчета
    async addReport(report) {
        if (!this.isConnected || !this.db || !this.userId) return;
        
        try {
            await this.db.collection('users').doc(this.userId)
                .collection('reports')
                .doc(report.id.toString())
                .set({
                    ...report,
                    deviceId: this.deviceId,
                    updatedAt: new Date().toISOString()
                });
            
            console.log('✅ Отчет добавлен в облако:', report.id);
            
        } catch (error) {
            console.error('❌ Ошибка добавления отчета в облако:', error);
        }
    }
    
    // Очистка отчетов
    async clearReports() {
        if (!this.isConnected || !this.db || !this.userId) return;
        
        try {
            const snapshot = await this.db.collection('users').doc(this.userId)
                .collection('reports')
                .get();
            
            const batch = this.db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            console.log('✅ Отчеты очищены в облаке');
            
        } catch (error) {
            console.error('❌ Ошибка очистки отчетов в облаке:', error);
        }
    }
    
    // Получение статуса подключения
    getStatus() {
        return {
            isConnected: this.isConnected,
            userId: this.userId,
            deviceId: this.deviceId
        };
    }
}
