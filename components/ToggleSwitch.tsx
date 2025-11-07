import React from 'react';

interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ label, checked, onChange }) => {
  const id = `toggle-${label.replace(/\s+/g, '-')}`;
  return (
    <label htmlFor={id} className="flex items-center justify-between cursor-pointer w-full" aria-label={label}>
      <span className="text-lg text-slate-300">{label}</span>
      <div className="relative">
        <input 
          id={id} 
          type="checkbox" 
          role="switch"
          aria-checked={checked}
          className="sr-only" 
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className={`block w-14 h-8 rounded-full transition-colors ${checked ? 'bg-cyan-500' : 'bg-slate-600'}`}></div>
        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${checked ? 'transform translate-x-6' : ''}`}></div>
      </div>
    </label>
  );
};

export default ToggleSwitch;
