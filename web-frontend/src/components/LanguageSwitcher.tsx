import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  };

  return (
    <div className="flex items-center space-x-1">
      <button
        onClick={() => changeLanguage('zh')}
        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${i18n.language === 'zh' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
      >
        中
      </button>
      <button
        onClick={() => changeLanguage('en')}
        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${i18n.language === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
      >
        En
      </button>
    </div>
  );
};

export default LanguageSwitcher;