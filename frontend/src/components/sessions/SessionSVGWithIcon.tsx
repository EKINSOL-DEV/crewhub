type MinionVariant = "orange" | "blue" | "green" | "purple" | "amber" | "pink" | "cyan"

const MINION_COLORS: Record<MinionVariant, {
  body: string
  bodyDark: string
  goggle: string
  eye: string
  overalls: string
}> = {
  orange: { body: "#FFA726", bodyDark: "#F57C00", goggle: "#9E9E9E", eye: "#5D4037", overalls: "#546E7A" },
  blue: { body: "#42A5F5", bodyDark: "#1E88E5", goggle: "#9E9E9E", eye: "#1B5E20", overalls: "#37474F" },
  green: { body: "#66BB6A", bodyDark: "#43A047", goggle: "#BDBDBD", eye: "#3E2723", overalls: "#455A64" },
  purple: { body: "#AB47BC", bodyDark: "#8E24AA", goggle: "#BDBDBD", eye: "#1A237E", overalls: "#37474F" },
  amber: { body: "#FFCA28", bodyDark: "#FFB300", goggle: "#9E9E9E", eye: "#33691E", overalls: "#546E7A" },
  pink: { body: "#EC407A", bodyDark: "#D81B60", goggle: "#BDBDBD", eye: "#311B92", overalls: "#455A64" },
  cyan: { body: "#29B6F6", bodyDark: "#0288D1", goggle: "#BDBDBD", eye: "#1B5E20", overalls: "#455A64" },
}

type AgentIcon = "crab" | "clock" | "camera" | "wave" | "gear" | "default"

interface MinionSVGWithIconProps {
  variant?: MinionVariant
  agentIcon?: AgentIcon
  size?: number
  flipped?: boolean
  animDelay?: number
}

export function MinionSVGWithIcon({
  variant = "orange",
  agentIcon = "default",
  size = 80,
  flipped = false,
  animDelay = 0,
}: MinionSVGWithIconProps) {
  const c = MINION_COLORS[variant]

  return (
    <div
      style={{
        display: "inline-block",
        transform: flipped ? "scaleX(-1)" : undefined,
        animation: `minionBob 3s ease-in-out ${animDelay}s infinite`,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 120">
        <ellipse cx="50" cy="65" rx="30" ry="38" fill={c.body} />
        <ellipse cx="50" cy="68" rx="30" ry="35" fill={c.bodyDark} opacity="0.15" />
        <rect x="25" y="72" width="50" height="30" rx="4" fill={c.overalls} />
        <rect x="35" y="72" width="30" height="18" rx="3" fill={c.overalls} />
        <line x1="35" y1="72" x2="32" y2="56" stroke={c.overalls} strokeWidth="4" strokeLinecap="round" />
        <line x1="65" y1="72" x2="68" y2="56" stroke={c.overalls} strokeWidth="4" strokeLinecap="round" />
        <rect x="40" y="80" width="20" height="14" rx="2" fill={c.overalls} stroke={c.body} strokeWidth="0.5" opacity="0.7" />
        
        <g transform="translate(50, 87)">
          {agentIcon === "crab" && (
            <>
              <ellipse cx="0" cy="0" rx="4" ry="3" fill="#FF6B6B" />
              <circle cx="-2" cy="-2" r="1.5" fill="#FF6B6B" />
              <circle cx="2" cy="-2" r="1.5" fill="#FF6B6B" />
              <line x1="-3.5" y1="-2" x2="-5" y2="-4" stroke="#FF6B6B" strokeWidth="1.2" />
              <line x1="3.5" y1="-2" x2="5" y2="-4" stroke="#FF6B6B" strokeWidth="1.2" />
            </>
          )}
          {agentIcon === "clock" && (
            <>
              <circle cx="0" cy="0" r="4.5" fill="none" stroke="#FFD700" strokeWidth="1.5" />
              <line x1="0" y1="0" x2="0" y2="-2.5" stroke="#FFD700" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="0" y1="0" x2="2" y2="1" stroke="#FFD700" strokeWidth="1.2" strokeLinecap="round" />
            </>
          )}
          {agentIcon === "camera" && (
            <>
              <rect x="-4" y="-2" width="8" height="5" rx="1" fill="#9C27B0" />
              <circle cx="0" cy="0.5" r="2" fill="#E1BEE7" />
              <rect x="4" y="-1.5" width="1.5" height="1.5" fill="#9C27B0" />
            </>
          )}
          {agentIcon === "wave" && (
            <>
              <path d="M -5 0 Q -3 -2, -1 0 T 3 0 Q 5 -2, 5 0" fill="none" stroke="#00BCD4" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M -5 2 Q -3 0, -1 2 T 3 2 Q 5 0, 5 2" fill="none" stroke="#00BCD4" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
            </>
          )}
          {agentIcon === "gear" && (
            <>
              <circle cx="0" cy="0" r="3.5" fill="none" stroke="#FFC107" strokeWidth="1.5" />
              <circle cx="0" cy="0" r="1.5" fill="#FFC107" />
              <rect x="-1" y="-5" width="2" height="2" fill="#FFC107" />
              <rect x="-1" y="3" width="2" height="2" fill="#FFC107" />
              <rect x="-5" y="-1" width="2" height="2" fill="#FFC107" />
              <rect x="3" y="-1" width="2" height="2" fill="#FFC107" />
            </>
          )}
          {agentIcon === "default" && (
            <text x="0" y="2" fontSize="8" fontWeight="bold" fill="#FFD700" textAnchor="middle" fontFamily="monospace">M</text>
          )}
        </g>

        <rect x="15" y="42" width="70" height="6" rx="3" fill={c.goggle} opacity="0.7" />
        <circle cx="50" cy="45" r="16" fill={c.goggle} />
        <circle cx="50" cy="45" r="13" fill="#ECEFF1" />
        <circle cx="50" cy="45" r="8" fill="white" />
        <circle cx="52" cy="44" r="5" fill={c.eye}>
          <animate attributeName="cx" values="52;48;52" dur="4s" begin={`${animDelay + 1}s`} repeatCount="indefinite" />
        </circle>
        <circle cx="53" cy="42" r="2" fill="white" />
        <ellipse cx="50" cy="45" rx="8" ry="0" fill={c.body}>
          <animate attributeName="ry" values="0;0;0;8;0;0;0" dur="4s" begin={`${animDelay + 2}s`} repeatCount="indefinite" />
        </ellipse>
        <path d="M 42 58 Q 50 65 58 58" fill="none" stroke="#5D4037" strokeWidth="2" strokeLinecap="round" />
        <path d="M 47 27 Q 48 20 50 27" stroke={c.bodyDark} strokeWidth="2" fill="none" />
        <path d="M 51 27 Q 53 18 54 27" stroke={c.bodyDark} strokeWidth="2" fill="none" />
        <ellipse cx="18" cy="75" rx="5" ry="8" fill={c.body} />
        <ellipse cx="82" cy="75" rx="5" ry="8" fill={c.body} />
        <ellipse cx="38" cy="103" rx="9" ry="5" fill="#212121" />
        <ellipse cx="62" cy="103" rx="9" ry="5" fill="#212121" />
        <rect x="34" y="95" width="8" height="10" rx="2" fill={c.overalls} />
        <rect x="58" y="95" width="8" height="10" rx="2" fill={c.overalls} />
      </svg>
    </div>
  )
}

// New export name + backwards compatibility alias
export { MinionSVGWithIcon as SessionSVGWithIcon }
