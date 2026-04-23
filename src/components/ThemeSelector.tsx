import React from 'react';
import { Palette } from 'lucide-react';

interface ThemeSelectorProps {
  currentTheme: string;
  onThemeChange: (theme: string) => void;
  compact?: boolean;
}

const THEMES = [
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    colors: ['#0ea5e9', '#f472b6', '#06b6d4'],
    icon: '⚡',
    description: 'Neon and electric vibes'
  },
  {
    id: 'matrix',
    name: 'Matrix',
    colors: ['#00ff41', '#008f11', '#00cc33'],
    icon: '🟢',
    description: 'Green screen retro'
  },
  {
    id: 'minimal',
    name: 'Minimal',
    colors: ['#0f172a', '#06b6d4', '#3b82f6'],
    icon: '◻',
    description: 'Clean and simple'
  },
  {
    id: 'deep-ocean',
    name: 'Deep Ocean',
    colors: ['#38bdf8', '#06b6d4', '#818cf8'],
    icon: '🌊',
    description: 'Underwater serenity'
  },
  {
    id: 'harry-potter',
    name: 'Harry Potter',
    colors: ['#d4af37', '#740001', '#eab308'],
    icon: '✨',
    description: 'Magical gold theme'
  },
  {
    id: 'marvel',
    name: 'Marvel',
    colors: ['#ed1d24', '#ffc72c', '#ff6b35'],
    icon: '🔴',
    description: 'Power and action'
  },
  {
    id: 'loki',
    name: 'Loki',
    colors: ['#d47522', '#5a7d6c', '#8b6f47'],
    icon: '🎭',
    description: 'TVA aesthetic'
  },
  {
    id: 'winamp',
    name: 'Winamp',
    colors: ['#00dd00', '#008800', '#00aa00'],
    icon: '🎵',
    description: 'Retro player classic'
  }
];

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  currentTheme,
  onThemeChange,
  compact = false
}) => {
  if (compact) {
    return (
      <div className="flex gap-2 flex-wrap">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => onThemeChange(theme.id)}
            className={`
              w-8 h-8 rounded-full border-2 transition-all duration-200
              ${currentTheme === theme.id
                ? 'ring-2 ring-offset-2 ring-offset-gray-800 scale-110'
                : 'hover:scale-105'
              }
            `}
            style={{
              background: `linear-gradient(135deg, ${theme.colors[0]}, ${theme.colors[1]})`,
              borderColor: theme.colors[2],
              boxShadow: currentTheme === theme.id
                ? `0 0 15px ${theme.colors[0]}`
                : 'none'
            }}
            title={theme.name}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="premium-card">
      <div className="flex items-center gap-3 mb-6">
        <Palette size={24} className="glow-text" />
        <h3 className="text-lg font-semibold gradient-text">Theme Selector</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => onThemeChange(theme.id)}
            className={`
              group relative overflow-hidden rounded-lg transition-all duration-300
              border-2 p-4 text-center
              ${currentTheme === theme.id
                ? 'border-[var(--accent-color)] bg-[var(--surface-color)] shadow-lg scale-105'
                : 'border-[var(--surface-border)] hover:border-[var(--accent-color)] hover:scale-105'
              }
            `}
          >
            {/* Color gradient preview */}
            <div className="mb-3 flex gap-1 justify-center">
              {theme.colors.map((color, idx) => (
                <div
                  key={idx}
                  className="w-6 h-6 rounded-lg shadow-md transition-transform group-hover:scale-110"
                  style={{
                    background: color,
                    boxShadow: `0 0 10px ${color}40`
                  }}
                />
              ))}
            </div>

            {/* Theme icon */}
            <div className="text-3xl mb-2">{theme.icon}</div>

            {/* Theme name */}
            <h4 className="font-bold text-sm mb-1 text-[var(--text-primary)]">
              {theme.name}
            </h4>

            {/* Theme description */}
            <p className="text-xs text-[var(--text-secondary)] opacity-70">
              {theme.description}
            </p>

            {/* Selection indicator */}
            {currentTheme === theme.id && (
              <div className="absolute inset-0 border-2 rounded-lg animation-pulse pointer-events-none"
                style={{
                  borderColor: 'var(--accent-color)',
                  boxShadow: 'inset 0 0 15px var(--accent-glow)',
                  animation: 'modulatePulse 2s ease-in-out infinite'
                }}
              />
            )}

            {/* Hover glow */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity rounded-lg"
              style={{
                background: `linear-gradient(135deg, ${theme.colors[0]}, ${theme.colors[1]})`
              }}
            />
          </button>
        ))}
      </div>

      {/* Current theme info */}
      <div className="mt-6 p-4 rounded-lg bg-[var(--surface-color)] border border-[var(--surface-border)]">
        <p className="text-xs text-[var(--text-secondary)] mb-2">ACTIVE THEME</p>
        <p className="text-lg font-bold text-[var(--accent-color)] glow-text">
          {THEMES.find(t => t.id === currentTheme)?.name}
        </p>
      </div>
    </div>
  );
};

export const ThemeSelectorCompact: React.FC<{
  currentTheme: string;
  onThemeChange: (theme: string) => void;
}> = ({ currentTheme, onThemeChange }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="premium-btn flex items-center gap-2"
      >
        <Palette size={16} />
        Theme
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0"
            onClick={() => setIsOpen(false)}
          />

          {/* Popup */}
          <div className="absolute right-0 mt-2 p-4 premium-card rounded-lg z-50 min-w-max shadow-lg">
            <ThemeSelector
              currentTheme={currentTheme}
              onThemeChange={(theme) => {
                onThemeChange(theme);
                setIsOpen(false);
              }}
              compact
            />
          </div>
        </>
      )}
    </div>
  );
};
