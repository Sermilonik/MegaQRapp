// Firebase Sync Manager
class FirebaseSyncManager {
    constructor() {
        this.db = null;
        this.userId = null;
        this.isConnected = false;
        this.syncEnabled = true; // Включить по умолчанию
        this.lastSyncTime = null;
        
        console.log('🔧 Создание FirebaseSyncManager...');
        this.init().catch(console.error);
    }

    async init() {
        console.log('🔄 Инициализация FirebaseSyncManager...');
        
        // Ждем загрузки Firebase
        let attempts = 0;
        while (typeof firebase === 'undefined' && attempts < 10) {
            console.log(`⏳ Ожидание Firebase... попытка ${attempts + 1}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }
    
        if (typeof firebase === 'undefined') {
            console.error('❌ Firebase не загружен после 10 попыток');
            return;
        }
    
        try {
            // Инициализируем Firebase если нужно
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
                console.log('✅ Firebase инициализирован');
            }
    
            // Инициализируем Firestore
            this.db = firebase.firestore();
            
            // Генерируем уникальный ID пользователя
            this.userId = this.getUserId();
            
            // Проверяем подключение
            this.isConnected = await this.testConnection();
            
            // Включаем синхронизацию
            this.syncEnabled = localStorage.getItem('firebase_sync_enabled') !== 'false';
            
            if (this.isConnected) {
                console.log('✅ FirebaseSyncManager готов');
                console.log(`👤 User ID: ${this.userId}`);
                console.log(`🔄 Sync enabled: ${this.syncEnabled}`);
                
                // Сразу загружаем данные
                await this.loadFromFirebase();
                
                // Обновляем UI
                this.updateSyncUI();
            }
            
        } catch (error) {
            console.error('❌ Ошибка инициализации FirebaseSyncManager:', error);
        }
    }

    // Тест подключения к Firebase
    async testConnection() {
        try {
            console.log('📡 Тестирование подключения к Firestore...');
            // Простая проверка - пытаемся прочитать несуществующий документ
            await this.db.collection('test_connection').doc('test').get();
            console.log('✅ Подключение к Firestore установлено');
            return true;
        } catch (error) {
            console.warn('⚠️ Нет подключения к Firestore:', error.message);
            return false;
        }
    }


    // Генерация уникального ID пользователя
    getUserId() {
        // ФИКСИРОВАННЫЙ ОБЩИЙ ID для продакшена
        // Можно добавить префикс для идентификации приложения
        const sharedUserId = 'qr_scanner_production_v1';
        console.log(`👤 Используется общий Production User ID: ${sharedUserId}`);
        return sharedUserId;
    }
    
    // Сохранение контрагентов в Firebase
    async saveContractorsToFirebase(contractors) {
        if (!this.isConnected) {
            console.log('🔄 Firebase не подключен, пропускаем сохранение');
            return false;
        }
    
        try {
            console.log(`💾 Сохранение ${contractors.length} контрагентов в Firebase...`);
    
            // ПРАВИЛЬНАЯ СТРУКТУРА - ПРЯМОЙ МАССИВ contractors
            const userData = {
                contractors: contractors, // ПРЯМОЙ МАССИВ, без вложенного array
                lastSync: new Date().toISOString(),
                count: contractors.length,
                version: '1.0',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                userAgent: navigator.userAgent.substring(0, 200),
                lastActivity: new Date().toISOString()
            };
    
            console.log('📤 Отправка данных в Firebase:', userData);
    
            await this.db.collection('users').doc(this.userId).set(userData, { merge: true });
    
            this.lastSyncTime = new Date();
            console.log(`✅ Контрагенты сохранены в Firebase: ${contractors.length} шт`);
            
            this.updateSyncUI();
            return true;
    
        } catch (error) {
            console.error('❌ Ошибка сохранения в Firebase:', error);
            return false;
        }
    }

    // Загрузка контрагентов из Firebase
    async loadFromFirebase() {
        if (!this.isConnected) {
            console.log('🔄 Firebase не подключен, пропускам загрузку');
            return null;
        }
    
        try {
            console.log('📥 Загрузка данных из Firebase...');
            const doc = await this.db.collection('users').doc(this.userId).get();
            
            if (doc.exists) {
                const data = doc.data();
                console.log('📄 Полные данные из Firebase:', data);
                
                // ПРАВИЛЬНОЕ ЧТЕНИЕ - ищем contractors на верхнем уровне
                if (data.contractors && Array.isArray(data.contractors)) {
                    const contractors = data.contractors;
                    this.lastSyncTime = new Date();
                    
                    console.log(`✅ Загружено из Firebase: ${contractors.length} контрагентов`);
                    
                    this.updateSyncUI();
                    return contractors;
                } 
                // Если данные в старой структуре (contractors.array)
                else if (data.contractors && data.contractors.array && Array.isArray(data.contractors.array)) {
                    console.log('🔄 Обнаружена старая структура данных, конвертируем...');
                    const contractors = data.contractors.array;
                    
                    // Миграция на новую структуру
                    await this.saveContractorsToFirebase(contractors);
                    
                    console.log(`✅ Загружено из старой структуры: ${contractors.length} контрагентов`);
                    return contractors;
                }
                else {
                    console.log('ℹ️ В Firebase нет массива contractors');
                }
            } else {
                console.log('ℹ️ Документ пользователя не существует в Firebase');
            }
            
            return null;
    
        } catch (error) {
            console.error('❌ Ошибка загрузки из Firebase:', error);
            return null;
        }
    }

    // Реальная синхронизация
    async syncContractors(localContractors) {
        if (!this.isConnected) {
            console.log('🔄 Firebase не подключен, используем локальные данные');
            return localContractors;
        }

        try {
            console.log('🔄 Начало синхронизации...');
            
            const cloudContractors = await this.loadFromFirebase();
            
            if (!cloudContractors || cloudContractors.length === 0) {
                console.log('☁️ В облаке нет данных, сохраняем локальные...');
                await this.saveContractorsToFirebase(localContractors);
                return localContractors;
            }

            const mergedContractors = this.mergeContractors(localContractors, cloudContractors);
            await this.saveContractorsToFirebase(mergedContractors);
            
            console.log(`🔄 Синхронизация завершена. Локально: ${localContractors.length}, Облако: ${cloudContractors.length}, Результат: ${mergedContractors.length}`);
            
            return mergedContractors;

        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
            return localContractors;
        }
    }

    // Объединение контрагентов
    mergeContractors(local, cloud) {
        console.log('🔄 Объединение данных...');
        const merged = [...local];
        let addedCount = 0;
        
        cloud.forEach(cloudContractor => {
            const existsById = merged.some(local => local.id === cloudContractor.id);
            const existsByName = merged.some(local => 
                local.name.toLowerCase() === cloudContractor.name.toLowerCase()
            );
            
            if (!existsById && !existsByName) {
                merged.push(cloudContractor);
                addedCount++;
            }
        });
        
        console.log(`📊 Объединение завершено. Добавлено: ${addedCount}, Всего: ${merged.length}`);
        return merged.sort((a, b) => a.id - b.id);
    }

    // Информация об устройстве
    getDeviceInfo() {
        return {
            platform: navigator.platform,
            userAgent: navigator.userAgent.substring(0, 100),
            screen: `${screen.width}x${screen.height}`,
            language: navigator.language
        };
    }

    // Принудительная синхронизация
    async forceSync(localContractors) {
        console.log('🔄 Принудительная синхронизация...');
        this.syncEnabled = true;
        return await this.syncContractors(localContractors);
    }

    // Включение/выключение синхронизации
    setSyncEnabled(enabled) {
        this.syncEnabled = enabled;
        localStorage.setItem('firebase_sync_enabled', enabled.toString());
        console.log(`🔄 Синхронизация ${enabled ? 'включена' : 'выключена'}`);
        this.updateSyncUI();
    }

    // Получение статуса синхронизации
    getSyncStatus() {
        return {
            isConnected: this.isConnected,
            syncEnabled: this.syncEnabled,
            userId: this.userId,
            lastSync: this.lastSyncTime
        };
    }

    // Обновление UI
    updateSyncUI() {
        if (window.scannerManager && typeof window.scannerManager.updateSyncUI === 'function') {
            window.scannerManager.updateSyncUI();
        }
    }
}

// Глобальный экземпляр
let firebaseSyncManager = null;

// Функция инициализации
function initFirebaseSync() {
    console.log('🚀 Инициализация Firebase Sync...');
    
    // Предотвращаем дублирование инициализации
    if (window.firebaseSyncManager) {
        console.log('✅ FirebaseSyncManager уже инициализирован');
        return window.firebaseSyncManager;
    }
    
    if (typeof firebase === 'undefined') {
        console.warn('⚠️ Firebase не загружен, повторная попытка через 3 секунды...');
        setTimeout(initFirebaseSync, 3000);
        return null;
    }

    if (!firebase.apps.length) {
        console.warn('⚠️ Firebase не инициализирован, повторная попытка через 2 секунды...');
        setTimeout(initFirebaseSync, 2000);
        return null;
    }

    try {
        window.firebaseSyncManager = new FirebaseSyncManager();
        return window.firebaseSyncManager;
    } catch (error) {
        console.error('❌ Ошибка создания FirebaseSyncManager:', error);
        return null;
    }
}

// Автоматическая инициализация
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM загружен, запуск Firebase Sync...');
    setTimeout(initFirebaseSync, 1000);
});