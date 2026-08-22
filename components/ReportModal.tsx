import React, { useState } from 'react';
import { useTranslations } from '../hooks/useTranslations';

interface ReportModalProps {
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

const REASONS = ['harassment', 'sexual_content', 'hate_speech', 'spam', 'other'] as const;

const ReportModal: React.FC<ReportModalProps> = ({ onClose, onSubmit }) => {
  const { t } = useTranslations();
  const [submitted, setSubmitted] = useState(false);

  const submit = (reason: string) => {
    onSubmit(reason);
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-sm w-full p-6">
        {submitted ? (
          <div className="text-center">
            <div className="text-4xl mb-3">✓</div>
            <p className="text-slate-200 font-semibold mb-2">{t('report_thanks')}</p>
            <p className="text-slate-400 text-sm mb-6">{t('report_thanks_desc')}</p>
            <button
              onClick={onClose}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 rounded-full"
            >
              {t('close')}
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-slate-200 mb-1">{t('report_title')}</h2>
            <p className="text-slate-400 text-sm mb-4">{t('report_desc')}</p>

            <div className="space-y-2 mb-4">
              {REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => submit(reason)}
                  className="w-full text-left bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg py-3 px-4"
                >
                  {t(`report_${reason}` as never)}
                </button>
              ))}
            </div>

            <button onClick={onClose} className="w-full text-slate-400 hover:text-slate-200 text-sm py-2">
              {t('close')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
