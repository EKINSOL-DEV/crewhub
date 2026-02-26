import { useState, useEffect, useCallback } from 'react'
import { DesignLab3D } from './DesignLab3D'

const BG_GRAY_800 = 'bg-gray-800'
const BG_GRAY_900 = 'bg-gray-900'
const CLS_BG_BLUE_500_TEXT_WHITE = 'bg-blue-500 text-white'
const CLS_BG_WHITE_SHADOW_LG = 'bg-white shadow-lg'
const CLS_FLEX_ITEMS_CENTER_GAP_3 = 'flex items-center gap-3'
const TEXT_GRAY_300 = 'text-gray-300'
const TEXT_GRAY_400 = 'text-gray-400'
const TEXT_GRAY_500 = 'text-gray-500'
const TEXT_GRAY_600 = 'text-gray-600'
const TEXT_GRAY_700 = 'text-gray-700'
const TEXT_GRAY_900 = 'text-gray-900'
const TEXT_WHITE = 'text-white'

interface AgentDesign {
  name: string
  file: string
  color: string
  description: string
  role: string
  fullDescription: string
  usedFor: string[]
  personality: string
}

const agents: AgentDesign[] = [
  {
    name: 'Worker Bot',
    file: 'worker-bot.svg',
    color: '#FE9600',
    description: 'Orange - Tool/Wrench icon',
    role: 'General-purpose task executor',
    fullDescription:
      'The workhorse of CrewHub. Handles day-to-day tasks, file operations, quick fixes, and anything that needs doing. Think of it as the reliable all-rounder.',
    usedFor: ['Task execution', 'File management', 'Simple automations', 'Background jobs'],
    personality: 'Dependable, efficient, always ready',
  },
  {
    name: 'Thinker Bot',
    file: 'thinker-bot.svg',
    color: '#1277C3',
    description: 'Blue - Lightbulb/Brain icon',
    role: 'Deep analysis & reasoning',
    fullDescription:
      'When a problem needs careful thought, the Thinker Bot steps in. It handles complex analysis, architecture decisions, and anything that requires deep reasoning.',
    usedFor: ['Code review', 'Architecture decisions', 'Complex debugging', 'Research', 'Planning'],
    personality: 'Thoughtful, methodical, sees the big picture',
  },
  {
    name: 'Cron Bot',
    file: 'cron-bot.svg',
    color: '#82B30E',
    description: 'Green - Clock icon',
    role: 'Scheduled & recurring tasks',
    fullDescription:
      'The timekeeper of the crew. Runs on schedules, monitors systems, and ensures nothing falls through the cracks. Always on duty, even when everyone else is sleeping.',
    usedFor: [
      'Scheduled checks',
      'Monitoring',
      'Periodic reports',
      'Reminders',
      'Automated workflows',
    ],
    personality: 'Punctual, tireless, consistent',
  },
  {
    name: 'Comms Bot',
    file: 'comms-bot.svg',
    color: '#9370DB',
    description: 'Purple - Chat bubble icon',
    role: 'Communication & coordination',
    fullDescription:
      'The social one. Handles messaging across platforms, coordinates between agents, and makes sure information flows where it needs to go.',
    usedFor: [
      'Message routing',
      'Cross-platform communication',
      'Notifications',
      'Team coordination',
    ],
    personality: 'Sociable, well-connected, clear communicator',
  },
  {
    name: 'Dev Bot',
    file: 'dev-bot.svg',
    color: '#F32A1C',
    description: 'Red - Code/Gear icon',
    role: 'Software development & coding',
    fullDescription:
      'The builder. Writes code, fixes bugs, implements features, and handles everything development-related. Speaks fluent TypeScript, Python, and whatever else is needed.',
    usedFor: ['Feature development', 'Bug fixes', 'Refactoring', 'Testing', 'CI/CD', 'Deployment'],
    personality: 'Creative, precise, loves clean code',
  },
]

function AgentDetailPanel({
  agent,
  darkBg,
  onClose,
}: {
  readonly agent: AgentDesign
  readonly darkBg: boolean
  readonly onClose: () => void
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 300) // Wait for exit animation
  }, [onClose])

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      {/* Backdrop */}
      <button
        type="button"
        className={`absolute inset-0 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={handleClose}
        aria-label="Close details panel"
      />

      {/* Slide-in Panel */}
      <div
        className={`relative w-full max-w-lg h-full overflow-y-auto transition-transform duration-300 ease-out
          ${visible ? 'translate-x-0' : 'translate-x-full'}
          ${darkBg ? BG_GRAY_900 : 'bg-white'}`}
        style={{ boxShadow: '-4px 0 24px rgba(0,0,0,0.2)' }}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className={`absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center text-lg transition-colors
            ${darkBg ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          ✕
        </button>

        {/* Color Banner */}
        <div className="h-2 w-full" style={{ backgroundColor: agent.color }} />

        {/* Large SVG Preview */}
        <div
          className={`flex items-center justify-center py-10 ${darkBg ? 'bg-gray-800/50' : 'bg-gray-50'}`}
        >
          <img
            src={`/agents/${agent.file}`}
            alt={agent.name}
            className="w-32 h-32 drop-shadow-lg"
          />
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Name & Role */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-5 h-5 rounded-full" style={{ backgroundColor: agent.color }} />
              <h2 className={`text-2xl font-bold ${darkBg ? TEXT_WHITE : TEXT_GRAY_900}`}>
                {agent.name}
              </h2>
            </div>
            <span
              className="inline-block px-3 py-1 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: agent.color }}
            >
              {agent.role}
            </span>
          </div>

          {/* Description */}
          <div>
            <h3
              className={`text-sm font-semibold uppercase tracking-wider mb-2 ${darkBg ? TEXT_GRAY_400 : TEXT_GRAY_500}`}
            >
              About
            </h3>
            <p className={`leading-relaxed ${darkBg ? TEXT_GRAY_300 : TEXT_GRAY_700}`}>
              {agent.fullDescription}
            </p>
          </div>

          {/* Used For */}
          <div>
            <h3
              className={`text-sm font-semibold uppercase tracking-wider mb-3 ${darkBg ? TEXT_GRAY_400 : TEXT_GRAY_500}`}
            >
              Used for
            </h3>
            <div className="flex flex-wrap gap-2">
              {agent.usedFor.map((use) => (
                <span
                  key={use}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${darkBg ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}
                  style={{ borderLeft: `3px solid ${agent.color}` }}
                >
                  {use}
                </span>
              ))}
            </div>
          </div>

          {/* Personality */}
          <div>
            <h3
              className={`text-sm font-semibold uppercase tracking-wider mb-2 ${darkBg ? TEXT_GRAY_400 : TEXT_GRAY_500}`}
            >
              Personality
            </h3>
            <p className={`italic ${darkBg ? TEXT_GRAY_300 : TEXT_GRAY_700}`}>
              "{agent.personality}"
            </p>
          </div>

          {/* File Reference */}
          <div>
            <h3
              className={`text-sm font-semibold uppercase tracking-wider mb-2 ${darkBg ? TEXT_GRAY_400 : TEXT_GRAY_500}`}
            >
              Asset
            </h3>
            <code
              className={`text-xs block p-3 rounded-lg
              ${darkBg ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}
            >
              /agents/{agent.file}
            </code>
          </div>

          {/* Color Swatch */}
          <div>
            <h3
              className={`text-sm font-semibold uppercase tracking-wider mb-2 ${darkBg ? TEXT_GRAY_400 : TEXT_GRAY_500}`}
            >
              Brand Color
            </h3>
            <div className={CLS_FLEX_ITEMS_CENTER_GAP_3}>
              <div
                className="w-10 h-10 rounded-lg shadow-inner"
                style={{ backgroundColor: agent.color }}
              />
              <code className={`text-sm ${darkBg ? TEXT_GRAY_400 : TEXT_GRAY_600}`}>
                {agent.color}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const sizes = [32, 64, 128] as const

export function DevDesigns() {
  const [darkBg, setDarkBg] = useState(false)
  const [selectedSize, setSelectedSize] = useState<number>(64)
  const [selectedAgent, setSelectedAgent] = useState<AgentDesign | null>(null)

  return (
    <div className={`min-h-screen p-8 ${darkBg ? BG_GRAY_900 : 'bg-gray-100'}`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${darkBg ? TEXT_WHITE : TEXT_GRAY_900}`}>
              🤖 Agent Design Lab
            </h1>
            <p className={`mt-2 ${darkBg ? TEXT_GRAY_400 : TEXT_GRAY_600}`}>
              Design proposals for CrewHub agent avatars
            </p>
          </div>

          <a
            href="/"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${
                darkBg
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm'
              }`}
          >
            ← Back to CrewHub
          </a>
        </div>

        {/* Controls */}
        <div
          className={`p-4 rounded-xl mb-8 flex items-center gap-6
          ${darkBg ? BG_GRAY_800 : 'bg-white shadow-sm'}`}
        >
          {/* Background Toggle */}
          <div className={CLS_FLEX_ITEMS_CENTER_GAP_3}>
            <span className={`text-sm font-medium ${darkBg ? TEXT_GRAY_300 : TEXT_GRAY_700}`}>
              Background:
            </span>
            <button
              onClick={() => setDarkBg(false)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${
                  darkBg
                    ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    : CLS_BG_BLUE_500_TEXT_WHITE
                }`}
            >
              ☀️ Light
            </button>
            <button
              onClick={() => setDarkBg(true)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${
                  darkBg
                    ? CLS_BG_BLUE_500_TEXT_WHITE
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
            >
              🌙 Dark
            </button>
          </div>

          {/* Size Controls */}
          <div className={CLS_FLEX_ITEMS_CENTER_GAP_3}>
            <span className={`text-sm font-medium ${darkBg ? TEXT_GRAY_300 : TEXT_GRAY_700}`}>
              Size:
            </span>
            {sizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${(() => {
                    if (selectedSize === size) return CLS_BG_BLUE_500_TEXT_WHITE
                    return darkBg
                      ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  })()}`}
              >
                {size}px
              </button>
            ))}
          </div>
        </div>

        {/* Agent Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <button
              key={agent.name}
              type="button"
              onClick={() => setSelectedAgent(agent)}
              className={`rounded-2xl p-6 transition-all hover:scale-[1.02] cursor-pointer text-left w-full
                ${darkBg ? BG_GRAY_800 : CLS_BG_WHITE_SHADOW_LG}`}
            >
              {/* Agent Preview */}
              <div
                className={`rounded-xl p-8 mb-4 flex items-center justify-center
                  ${darkBg ? BG_GRAY_900 : 'bg-gray-50'}`}
                style={{ minHeight: 160 }}
              >
                <img
                  src={`/agents/${agent.file}`}
                  alt={agent.name}
                  style={{ width: selectedSize, height: selectedSize }}
                  className="transition-all duration-200"
                />
              </div>

              {/* Agent Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: agent.color }} />
                  <h3 className={`font-semibold ${darkBg ? TEXT_WHITE : TEXT_GRAY_900}`}>
                    {agent.name}
                  </h3>
                </div>
                <p className={`text-sm ${darkBg ? TEXT_GRAY_400 : TEXT_GRAY_600}`}>
                  {agent.description}
                </p>
                <code
                  className={`text-xs block p-2 rounded
                  ${darkBg ? 'bg-gray-900 text-gray-400' : 'bg-gray-100 text-gray-600'}`}
                >
                  /agents/{agent.file}
                </code>
              </div>
            </button>
          ))}
        </div>

        {/* All Sizes Comparison */}
        <div className={`mt-12 rounded-2xl p-6 ${darkBg ? BG_GRAY_800 : CLS_BG_WHITE_SHADOW_LG}`}>
          <h2 className={`text-xl font-bold mb-6 ${darkBg ? TEXT_WHITE : TEXT_GRAY_900}`}>
            📐 Size Comparison
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={darkBg ? TEXT_GRAY_400 : TEXT_GRAY_600}>
                  <th className="text-left py-3 px-4 font-medium">Agent</th>
                  {sizes.map((size) => (
                    <th key={size} className="text-center py-3 px-4 font-medium">
                      {size}px
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr
                    key={agent.name}
                    className={`border-t ${darkBg ? 'border-gray-700' : 'border-gray-100'}`}
                  >
                    <td className={`py-4 px-4 font-medium ${darkBg ? TEXT_WHITE : TEXT_GRAY_900}`}>
                      {agent.name}
                    </td>
                    {sizes.map((size) => (
                      <td key={size} className="py-4 px-4 text-center">
                        <div className="inline-flex items-center justify-center">
                          <img
                            src={`/agents/${agent.file}`}
                            alt={`${agent.name} ${size}px`}
                            style={{ width: size, height: size }}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Design Specs */}
        <div className={`mt-8 rounded-2xl p-6 ${darkBg ? BG_GRAY_800 : CLS_BG_WHITE_SHADOW_LG}`}>
          <h2 className={`text-xl font-bold mb-4 ${darkBg ? TEXT_WHITE : TEXT_GRAY_900}`}>
            📋 Design Specifications
          </h2>
          <ul className={`space-y-2 text-sm ${darkBg ? TEXT_GRAY_300 : TEXT_GRAY_600}`}>
            <li>
              ✓ <strong>Rounded shapes</strong> - Friendly, approachable appearance
            </li>
            <li>
              ✓ <strong>Consistent viewBox</strong> - 128x128 for clean scaling
            </li>
            <li>
              ✓ <strong>Gradient fills</strong> - Depth and visual interest
            </li>
            <li>
              ✓ <strong>Unique icons</strong> - Each bot has a role-specific identifier
            </li>
            <li>
              ✓ <strong>Color-coded</strong> - Easy recognition at any size
            </li>
            <li>
              ✓ <strong>Clean vectors</strong> - Crisp rendering at all sizes
            </li>
          </ul>
        </div>

        {/* 3D POC Section */}
        <DesignLab3D darkBg={darkBg} />
      </div>

      {/* Agent Detail Panel */}
      {selectedAgent && (
        <AgentDetailPanel
          agent={selectedAgent}
          darkBg={darkBg}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  )
}
