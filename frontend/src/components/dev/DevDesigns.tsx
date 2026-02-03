import { useState } from 'react'

interface AgentDesign {
  name: string
  file: string
  color: string
  description: string
}

const agents: AgentDesign[] = [
  { name: 'Worker Bot', file: 'worker-bot.svg', color: '#FE9600', description: 'Orange - Tool/Wrench icon' },
  { name: 'Thinker Bot', file: 'thinker-bot.svg', color: '#1277C3', description: 'Blue - Lightbulb/Brain icon' },
  { name: 'Cron Bot', file: 'cron-bot.svg', color: '#82B30E', description: 'Green - Clock icon' },
  { name: 'Comms Bot', file: 'comms-bot.svg', color: '#9370DB', description: 'Purple - Chat bubble icon' },
  { name: 'Dev Bot', file: 'dev-bot.svg', color: '#F32A1C', description: 'Red - Code/Gear icon' },
]

const sizes = [32, 64, 128] as const

export function DevDesigns() {
  const [darkBg, setDarkBg] = useState(false)
  const [selectedSize, setSelectedSize] = useState<number>(64)

  return (
    <div className={`min-h-screen p-8 ${darkBg ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${darkBg ? 'text-white' : 'text-gray-900'}`}>
              🤖 Agent Design Lab
            </h1>
            <p className={`mt-2 ${darkBg ? 'text-gray-400' : 'text-gray-600'}`}>
              Design proposals for CrewHub agent avatars
            </p>
          </div>
          
          <a 
            href="/"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${darkBg 
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm'
              }`}
          >
            ← Back to CrewHub
          </a>
        </div>

        {/* Controls */}
        <div className={`p-4 rounded-xl mb-8 flex items-center gap-6 
          ${darkBg ? 'bg-gray-800' : 'bg-white shadow-sm'}`}>
          
          {/* Background Toggle */}
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${darkBg ? 'text-gray-300' : 'text-gray-700'}`}>
              Background:
            </span>
            <button
              onClick={() => setDarkBg(false)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${!darkBg 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
            >
              ☀️ Light
            </button>
            <button
              onClick={() => setDarkBg(true)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${darkBg 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
            >
              🌙 Dark
            </button>
          </div>

          {/* Size Controls */}
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${darkBg ? 'text-gray-300' : 'text-gray-700'}`}>
              Size:
            </span>
            {sizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${selectedSize === size
                    ? 'bg-blue-500 text-white'
                    : darkBg 
                      ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
              >
                {size}px
              </button>
            ))}
          </div>
        </div>

        {/* Agent Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <div
              key={agent.name}
              className={`rounded-2xl p-6 transition-all hover:scale-[1.02]
                ${darkBg ? 'bg-gray-800' : 'bg-white shadow-lg'}`}
            >
              {/* Agent Preview */}
              <div 
                className={`rounded-xl p-8 mb-4 flex items-center justify-center
                  ${darkBg ? 'bg-gray-900' : 'bg-gray-50'}`}
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
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: agent.color }}
                  />
                  <h3 className={`font-semibold ${darkBg ? 'text-white' : 'text-gray-900'}`}>
                    {agent.name}
                  </h3>
                </div>
                <p className={`text-sm ${darkBg ? 'text-gray-400' : 'text-gray-600'}`}>
                  {agent.description}
                </p>
                <code className={`text-xs block p-2 rounded
                  ${darkBg ? 'bg-gray-900 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                  /agents/{agent.file}
                </code>
              </div>
            </div>
          ))}
        </div>

        {/* All Sizes Comparison */}
        <div className={`mt-12 rounded-2xl p-6 ${darkBg ? 'bg-gray-800' : 'bg-white shadow-lg'}`}>
          <h2 className={`text-xl font-bold mb-6 ${darkBg ? 'text-white' : 'text-gray-900'}`}>
            📐 Size Comparison
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={darkBg ? 'text-gray-400' : 'text-gray-600'}>
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
                    <td className={`py-4 px-4 font-medium ${darkBg ? 'text-white' : 'text-gray-900'}`}>
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
        <div className={`mt-8 rounded-2xl p-6 ${darkBg ? 'bg-gray-800' : 'bg-white shadow-lg'}`}>
          <h2 className={`text-xl font-bold mb-4 ${darkBg ? 'text-white' : 'text-gray-900'}`}>
            📋 Design Specifications
          </h2>
          <ul className={`space-y-2 text-sm ${darkBg ? 'text-gray-300' : 'text-gray-600'}`}>
            <li>✓ <strong>Rounded shapes</strong> - Friendly, approachable appearance</li>
            <li>✓ <strong>Consistent viewBox</strong> - 128x128 for clean scaling</li>
            <li>✓ <strong>Gradient fills</strong> - Depth and visual interest</li>
            <li>✓ <strong>Unique icons</strong> - Each bot has a role-specific identifier</li>
            <li>✓ <strong>Color-coded</strong> - Easy recognition at any size</li>
            <li>✓ <strong>Clean vectors</strong> - Crisp rendering at all sizes</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
