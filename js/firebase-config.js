// Firebase Configuration v8
console.log('🚀 Загрузка Firebase configuration...');

// Конфигурация Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBbRTznLutKj0wx5xYi8s3oqWclVM5HGzU",
    authDomain: "qr-scanner-sync.firebaseapp.com",
    projectId: "qr-scanner-sync",
    storageBucket: "qr-scanner-sync.firebasestorage.app",
    messagingSenderId: "779585079502",
    appId: "1:779585079502:web:0ff836dd133661dbbd689f"
};

// Функция инициализации Firebase
function initializeFirebase() {
    console.log('🔧 Инициализация Firebase...');
    
    try {
        if (typeof firebase === 'undefined') {
            console.error('❌ Firebase не загружен');
            return false;
        }

        // Проверяем, не инициализирован ли уже Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('✅ Firebase успешно инициализирован');
            return true;
        } else {
            console.log('✅ Firebase уже инициализирован');
            return true;
        }
    } catch (error) {
        console.error('❌ Ошибка инициализации Firebase:', error);
        return false;
    }
}

// Автоматическая инициализация при загрузке Firebase
if (typeof firebase !== 'undefined') {
    initializeFirebase();
} else {
    console.log('⏳ Ожидание загрузки Firebase...');
    // Повторная попытка через 2 секунды
    setTimeout(initializeFirebase, 2000);
}