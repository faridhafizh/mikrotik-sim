import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/jetbrains-mono'
import './styles/app.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
createApp(App).use(createPinia()).mount('#app')
