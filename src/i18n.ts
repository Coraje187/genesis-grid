import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translations
const resources = {
  en: {
    translation: {
      "chat": "Chat",
      "chatsAndProjects": "Chats & projects",
      "memoryCore": "Memory Core",
      "myMachine": "My machine",
      "modelLibrary": "Model library",
      "useOnlineInstead": "Use online instead",
      "settings": "Settings",
      "language": "Language"
    }
  },
  es: {
    translation: {
      "chat": "Chat",
      "chatsAndProjects": "Chats y proyectos",
      "memoryCore": "Núcleo de Memoria",
      "myMachine": "Mi máquina",
      "modelLibrary": "Biblioteca de modelos",
      "useOnlineInstead": "Usar en línea en su lugar",
      "settings": "Ajustes",
      "language": "Idioma"
    }
  },
  zh: {
    translation: {
      "chat": "聊天",
      "chatsAndProjects": "聊天与项目",
      "memoryCore": "记忆核心",
      "myMachine": "我的设备",
      "modelLibrary": "模型库",
      "useOnlineInstead": "使用在线模式",
      "settings": "设置",
      "language": "语言"
    }
  },
  fr: {
    translation: {
      "chat": "Discussion",
      "chatsAndProjects": "Discussions & projets",
      "memoryCore": "Cœur de Mémoire",
      "myMachine": "Ma machine",
      "modelLibrary": "Bibliothèque de modèles",
      "useOnlineInstead": "Utiliser en ligne",
      "settings": "Paramètres",
      "language": "Langue"
    }
  },
  de: {
    translation: {
      "chat": "Chat",
      "chatsAndProjects": "Chats & Projekte",
      "memoryCore": "Speicherkern",
      "myMachine": "Meine Maschine",
      "modelLibrary": "Modellbibliothek",
      "useOnlineInstead": "Stattdessen online nutzen",
      "settings": "Einstellungen",
      "language": "Sprache"
    }
  },
  ja: {
    translation: {
      "chat": "チャット",
      "chatsAndProjects": "チャット＆プロジェクト",
      "memoryCore": "メモリコア",
      "myMachine": "マイマシン",
      "modelLibrary": "モデルライブラリ",
      "useOnlineInstead": "オンラインで利用する",
      "settings": "設定",
      "language": "言語"
    }
  },
  hi: {
    translation: {
      "chat": "चैट",
      "chatsAndProjects": "चैट और प्रोजेक्ट्स",
      "memoryCore": "मेमोरी कोर",
      "myMachine": "मेरी मशीन",
      "modelLibrary": "मॉडल लाइब्रेरी",
      "useOnlineInstead": "ऑनलाइन उपयोग करें",
      "settings": "सेटिंग्स",
      "language": "भाषा"
    }
  }
};

const savedLanguage = window.localStorage.getItem('genesis_language') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage, // Default language from local storage or english
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes by default
    }
  });

export default i18n;
