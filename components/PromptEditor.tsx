import React, { useState } from 'react';
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface PromptEditorProps {
  title: string;
  initialValue: string;
  onSave: (value: string) => void;
  loading: boolean;
}

const PromptEditor: React.FC<PromptEditorProps> = ({ title, initialValue, onSave, loading }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);

  const handleSave = () => {
    onSave(value);
    setEditing(false);
  };

  const renderPreview = (text: string) => {
    if (text.length <= 100) {
      return text;
    }
    return `${text.substring(0, 100)}...`;
  };

  return (
    <div>
      <label className="block text-md text-slate-300 mb-2">{title}</label>
      {editing ? (
        <div>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 h-32"
            disabled={loading}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
              disabled={loading}
            >
              <CheckIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setEditing(false)}
              className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-md"
              disabled={loading}
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-slate-400 bg-slate-900 p-3 rounded-md">
            {renderPreview(initialValue)}
          </p>
          <button
            onClick={() => setEditing(true)}
            className="mt-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-1 rounded-md text-sm"
            disabled={loading}
          >
            <PencilIcon className="w-4 h-4 inline-block mr-1" />
            Edit
          </button>
        </div>
      )}
    </div>
  );
};

export default PromptEditor;
