import React, { useState, useEffect } from 'react';

// Parse value - handles both string (from DB) and object
const parseOverrides = (val) => {
  if (!val) return {};
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return {}; }
  }
  return val;
};

export function ConfigOverrides({ value, onChange }) {
  const [globalConfig, setGlobalConfig] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  useEffect(() => {
    fetch('/api/validation-config')
      .then(r => r.json())
      .then(setGlobalConfig)
      .catch(() => setGlobalConfig({}));
  }, []);

  const overrides = parseOverrides(value);

  const toJsonString = (val) => JSON.stringify(val);

  const parseJsonValue = (str) => {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  };

  const addOverride = (key) => {
    const defaultValue = globalConfig?.[key];
    const newOverrides = { ...overrides, [key]: defaultValue !== undefined ? defaultValue : '' };
    onChange(newOverrides);
    setShowDropdown(false);
  };

  const addCustomOverride = () => {
    if (!customKeyInput.trim()) return;
    onChange({ ...overrides, [customKeyInput.trim()]: '' });
    setCustomKeyInput('');
    setShowCustomInput(false);
    setShowDropdown(false);
  };

  const handleCustomKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomOverride();
    } else if (e.key === 'Escape') {
      setCustomKeyInput('');
      setShowCustomInput(false);
    }
  };

  const updateValue = (key, jsonStr) => {
    onChange({ ...overrides, [key]: parseJsonValue(jsonStr) });
  };

  const removeOverride = (key) => {
    const newOverrides = { ...overrides };
    delete newOverrides[key];
    onChange(Object.keys(newOverrides).length > 0 ? newOverrides : null);
  };

  if (!globalConfig) {
    return <div className="text-gray-500 text-sm">Loading config...</div>;
  }

  const globalKeys = Object.keys(globalConfig);
  const availableKeys = globalKeys.filter(k => !(k in overrides));

  return (
    <div className="space-y-2">
      {Object.entries(overrides).map(([key, val], idx) => {
        const isKnownKey = globalKeys.includes(key);
        const globalValue = globalConfig[key];
        
        return (
          <div key={idx} className="flex gap-2 items-center">
            <div className="w-48 flex-shrink-0">
              <div className="px-2 py-1 rounded-md border border-charcoal-200 bg-charcoal-600 text-gray-300 text-sm font-mono truncate" title={key}>
                {key}
              </div>
            </div>
            <input
              value={toJsonString(val)}
              onChange={(e) => updateValue(key, e.target.value)}
              placeholder="value"
              className="flex-1 px-2 py-1 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="button"
              onClick={() => removeOverride(key)}
              className="px-2 py-1 text-red-400 hover:text-red-300 text-sm flex-shrink-0"
            >
              ✕
            </button>
            {isKnownKey && (
              <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                global: {toJsonString(globalValue)}
              </span>
            )}
          </div>
        );
      })}
      
      {showCustomInput && (
        <div className="flex gap-2 items-center">
          <input
            value={customKeyInput}
            onChange={(e) => setCustomKeyInput(e.target.value)}
            onKeyDown={handleCustomKeyDown}
            placeholder="key name"
            autoFocus
            className="w-48 flex-shrink-0 px-2 py-1 rounded-md border border-purple-500 bg-charcoal-400 text-gray-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="button"
            onClick={addCustomOverride}
            disabled={!customKeyInput.trim()}
            className="px-2 py-1 text-purple-400 hover:text-purple-300 text-sm disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => { setCustomKeyInput(''); setShowCustomInput(false); }}
            className="px-2 py-1 text-gray-500 hover:text-gray-400 text-sm"
          >
            Cancel
          </button>
        </div>
      )}
      
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className="text-xs text-purple-400 hover:text-purple-300"
        >
          + Config Override
        </button>
        
        {showDropdown && (
          <div className="absolute left-0 top-6 z-10 bg-charcoal-400 border border-charcoal-200 rounded-md shadow-lg py-1 min-w-48">
            {availableKeys.map(key => (
              <button
                key={key}
                type="button"
                onClick={() => addOverride(key)}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-charcoal-300 font-mono"
              >
                {key}
              </button>
            ))}
            {availableKeys.length > 0 && <div className="border-t border-charcoal-200 my-1" />}
            <button
              type="button"
              onClick={() => { setShowCustomInput(true); setShowDropdown(false); }}
              className="w-full text-left px-3 py-1.5 text-sm text-purple-300 hover:bg-charcoal-300"
            >
              Custom...
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
