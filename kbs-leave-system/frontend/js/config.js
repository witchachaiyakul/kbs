const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

window.APP_CONFIG = Object.assign({
    apiUrl: isLocalHost
        ? 'http://127.0.0.1:5001/demo-kbs-leave/us-central1/gasApi'
        : 'https://us-central1-YOUR_FIREBASE_PROJECT_ID.cloudfunctions.net/gasApi'
}, window.APP_CONFIG || {});